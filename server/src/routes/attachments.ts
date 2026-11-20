import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { NextFunction, Response } from 'express'
import type pg from 'pg'
import { z } from 'zod'
import { pool, withTransaction } from '../db.js'
import { cleanFilename, MAX_ATTACHMENT_BYTES, mediaTypeForFilename, sniffMediaType } from '../attachments/rules.js'
import type { FileStorage, StoredObject } from '../attachments/storage.js'
import { storageConfigFromEnv, supabaseStorage, TooLargeError } from '../attachments/storage.js'

// Attachments on a case (#63). Files belong to versions: each version links to
// the files it had (case_version_file). Only the current draft version can gain or
// lose files, and removing one only unlinks it, so older versions and the stored
// object are untouched. design.md section 3.3 has the full rules.
//
// Upload happens in three steps so file bytes never pass through the API
// (Vercel caps request bodies at a few MB):
//   1. POST /uploads      checks name, type and size, then returns a signed upload link
//   2. the browser PUTs the file straight to private storage with that link
//   3. POST /             reads the stored object back, checks its real type, size and
//                         SHA-256, and only then records it. Any failure deletes the
//                         object, so a failed upload leaves no row and no stored file.

const DOWNLOAD_LINK_SECONDS = 60
// Objects older than this with no case_file row were abandoned mid-upload.
const ABANDONED_UPLOAD_MS = 60 * 60 * 1000

const positiveId = z
  .string()
  .regex(/^[1-9][0-9]{0,9}$/)
  .transform(Number)
  .refine((id) => id <= 2_147_483_647)

const filename = z.string().max(1000).transform((value, ctx) => {
  const cleaned = cleanFilename(value)
  if (!cleaned) ctx.addIssue({ code: 'custom', message: 'A file name is required' })
  return cleaned ?? ''
})

const uploadRequestBody = z.object({
  filename,
  sizeBytes: z.number().int().positive(),
})

const finalizeBody = z.object({
  uploadKey: z.string().max(100),
  filename,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

const listQuery = z.object({ versionId: positiveId.optional() })

const FILE_COLUMNS = `f.id, f.original_filename AS filename, f.media_type AS "mediaType",
  f.size_bytes::int AS "sizeBytes", f.sha256, f.uploaded_at AS "uploadedAt"`

type RunQuery = (text: string, values: unknown[]) => Promise<pg.QueryResult>
const onPool: RunQuery = (text, values) => pool.query(text, values)

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

// The router is mounted at /api/cases/:caseId/attachments with mergeParams, so
// :caseId is there at runtime, but Express's types only see this router's own paths.
function mountedCaseId(req: { params: unknown }): unknown {
  return (req.params as Record<string, unknown>).caseId
}

function defaultStorage(): FileStorage | null {
  const config = storageConfigFromEnv()
  return config ? supabaseStorage(config) : null
}

// Lets the Edit-case work (#56) give a new version the same files as the one it
// replaces. Call it inside the transaction that inserts the new version.
export async function carryForwardAttachments(client: pg.PoolClient, fromVersionId: number, toVersionId: number) {
  await client.query(
    `INSERT INTO case_version_file (case_version_id, case_file_id, case_id)
     SELECT $2, case_file_id, case_id FROM case_version_file WHERE case_version_id = $1`,
    [fromVersionId, toVersionId],
  )
}

export function attachmentsRouter(getStorage: () => FileStorage | null = defaultStorage) {
  const router = Router({ mergeParams: true })

  // Deletes a stored object unless a case_file row already owns it (for example a
  // second finalize of the same upload). Failures are swallowed: the abandoned-upload
  // sweep below retries later, and the caller's own error is what matters.
  async function discard(storage: FileStorage, key: string) {
    try {
      const owned = await pool.query('SELECT 1 FROM case_file WHERE storage_key = $1', [key])
      if (owned.rows.length === 0) await storage.remove([key])
    } catch {
      console.error('Could not discard a rejected upload')
    }
  }

  // Removes this case's stored objects that never got a case_file row (the browser
  // closed between upload and finalize). Best effort; never blocks an upload.
  async function sweepAbandoned(storage: FileStorage, caseId: number) {
    try {
      const cutoff = Date.now() - ABANDONED_UPLOAD_MS
      const old = (await storage.list(`cases/${caseId}`)).filter((item) => item.createdAt.getTime() < cutoff)
      if (old.length === 0) return
      const keys = old.map((item) => item.key)
      const owned = await pool.query<{ storage_key: string }>(
        'SELECT storage_key FROM case_file WHERE storage_key = ANY($1::text[])', [keys])
      const ownedKeys = new Set(owned.rows.map((row) => row.storage_key))
      await storage.remove(keys.filter((key) => !ownedKeys.has(key)))
    } catch {
      console.error('Could not sweep abandoned uploads')
    }
  }

  function parseCaseId(raw: unknown) {
    const parsed = positiveId.safeParse(raw)
    return parsed.success ? parsed.data : null
  }

  // The case's current version, if it has one, and whether files may change on it.
  async function currentVersion(run: RunQuery, caseId: number, lock = false) {
    const result = await run(
      `SELECT v.id AS "versionId", v.status
         FROM sim_case c
         LEFT JOIN case_version v ON v.id = c.current_version_id AND v.case_id = c.id
        WHERE c.id = $1${lock ? ' FOR UPDATE OF c' : ''}`,
      [caseId],
    )
    const row: { versionId: number | null; status: string | null } | undefined = result.rows[0]
    if (!row) throw new HttpError(404, 'not_found')
    return row
  }

  function requireDraft(version: { versionId: number | null; status: string | null }) {
    if (version.versionId === null || version.status !== 'draft') {
      throw new HttpError(409, 'version_not_editable')
    }
    return version.versionId
  }

  function sendError(res: Response, error: unknown, next: NextFunction) {
    if (error instanceof HttpError) res.status(error.status).json({ error: error.code })
    // Two finalize calls for the same upload: the first one recorded it.
    else if ((error as { code?: unknown } | null)?.code === '23505') res.status(409).json({ error: 'already_attached' })
    else next(error)
  }

  // List the files on the current version, or on ?versionId= (any version of this case).
  router.get('/', async (req, res, next) => {
    const caseId = parseCaseId(mountedCaseId(req))
    const query = listQuery.safeParse(req.query)
    if (caseId === null || !query.success) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    try {
      const versionResult = await pool.query<{ versionId: number | null; status: string | null; isCurrent: boolean | null }>(
        `SELECT v.id AS "versionId", v.status, v.id = c.current_version_id AS "isCurrent"
           FROM sim_case c
           LEFT JOIN case_version v ON v.case_id = c.id AND v.id = COALESCE($2::int, c.current_version_id)
          WHERE c.id = $1`,
        [caseId, query.data.versionId ?? null],
      )
      const version = versionResult.rows[0]
      if (!version || (query.data.versionId !== undefined && version.versionId === null)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (version.versionId === null) {
        res.json({ versionId: null, editable: false, files: [] })
        return
      }
      const files = await pool.query(
        `SELECT ${FILE_COLUMNS}
           FROM case_version_file l
           JOIN case_file f ON f.id = l.case_file_id AND f.case_id = l.case_id
          WHERE l.case_version_id = $1 AND l.case_id = $2
          ORDER BY f.uploaded_at, f.id`,
        [version.versionId, caseId],
      )
      res.json({
        versionId: version.versionId,
        editable: version.isCurrent === true && version.status === 'draft',
        files: files.rows,
      })
    } catch (error) {
      next(error)
    }
  })

  // Step 1: check the file before anything is stored and hand back a signed upload link.
  router.post('/uploads', async (req, res, next) => {
    const caseId = parseCaseId(mountedCaseId(req))
    const body = uploadRequestBody.safeParse(req.body)
    if (caseId === null || !body.success) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    const mediaType = mediaTypeForFilename(body.data.filename)
    if (!mediaType) {
      res.status(400).json({ error: 'unsupported_type' })
      return
    }
    if (body.data.sizeBytes > MAX_ATTACHMENT_BYTES) {
      res.status(400).json({ error: 'file_too_large' })
      return
    }
    const storage = getStorage()
    if (!storage) {
      res.status(503).json({ error: 'storage_unavailable' })
      return
    }
    try {
      requireDraft(await currentVersion(onPool, caseId))
      await sweepAbandoned(storage, caseId)
      const uploadKey = `cases/${caseId}/${randomUUID()}`
      const uploadUrl = await storage.createUploadUrl(uploadKey)
      res.status(201).json({ uploadKey, uploadUrl, mediaType, maxBytes: MAX_ATTACHMENT_BYTES })
    } catch (error) {
      sendError(res, error, next)
    }
  })

  // Step 3: verify what was actually stored, then record it on the current draft version.
  router.post('/', async (req, res, next) => {
    const caseId = parseCaseId(mountedCaseId(req))
    const body = finalizeBody.safeParse(req.body)
    const keyPattern = new RegExp(`^cases/${caseId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
    if (caseId === null || !body.success || !keyPattern.test(body.data.uploadKey)) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    const { uploadKey, filename: name, sha256 } = body.data
    const expectedType = mediaTypeForFilename(name)
    if (!expectedType) {
      res.status(400).json({ error: 'unsupported_type' })
      return
    }
    const storage = getStorage()
    if (!storage) {
      res.status(503).json({ error: 'storage_unavailable' })
      return
    }

    let stored: StoredObject | null
    try {
      stored = await storage.read(uploadKey, MAX_ATTACHMENT_BYTES)
    } catch (error) {
      if (error instanceof TooLargeError) {
        await discard(storage, uploadKey)
        res.status(400).json({ error: 'file_too_large' })
      } else {
        next(error)
      }
      return
    }
    if (!stored) {
      res.status(400).json({ error: 'upload_not_found' })
      return
    }

    // The stored Content-Type came from the browser; the bytes decide the real type.
    const storedType = stored.contentType?.split(';')[0].trim().toLowerCase()
    const reject = stored.bytes.length === 0 || sniffMediaType(stored.bytes) !== expectedType
      || storedType !== expectedType
      ? 'unsupported_type'
      : createHash('sha256').update(stored.bytes).digest('hex') !== sha256
        ? 'checksum_mismatch'
        : null
    if (reject) {
      await discard(storage, uploadKey)
      res.status(400).json({ error: reject })
      return
    }

    try {
      const file = await withTransaction(async (client) => {
        const run: RunQuery = (text, values) => client.query(text, values)
        const versionId = requireDraft(await currentVersion(run, caseId, true))
        const inserted = await client.query(
          `INSERT INTO case_file (case_id, storage_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, original_filename AS filename, media_type AS "mediaType",
                     size_bytes::int AS "sizeBytes", sha256, uploaded_at AS "uploadedAt"`,
          [caseId, uploadKey, name, expectedType, stored.bytes.length, sha256, res.locals.instructorId],
        )
        await client.query(
          'INSERT INTO case_version_file (case_version_id, case_file_id, case_id) VALUES ($1, $2, $3)',
          [versionId, inserted.rows[0].id, caseId],
        )
        return inserted.rows[0]
      })
      res.status(201).json(file)
    } catch (error) {
      await discard(storage, uploadKey)
      sendError(res, error, next)
    }
  })

  // A short-lived link that downloads one file. Works for files on any version of
  // this case, so older versions can still be opened.
  router.get('/:fileId/download', async (req, res, next) => {
    const caseId = parseCaseId(mountedCaseId(req))
    const fileId = parseCaseId(req.params.fileId)
    if (caseId === null || fileId === null) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    const storage = getStorage()
    if (!storage) {
      res.status(503).json({ error: 'storage_unavailable' })
      return
    }
    try {
      const result = await pool.query<{ storage_key: string; original_filename: string }>(
        `SELECT f.storage_key, f.original_filename
           FROM case_file f
          WHERE f.id = $2 AND f.case_id = $1
            AND EXISTS (SELECT 1 FROM case_version_file l WHERE l.case_file_id = f.id)`,
        [caseId, fileId],
      )
      const file = result.rows[0]
      if (!file) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const url = await storage.createDownloadUrl(file.storage_key, file.original_filename, DOWNLOAD_LINK_SECONDS)
      res.json({ url, expiresInSeconds: DOWNLOAD_LINK_SECONDS })
    } catch (error) {
      next(error)
    }
  })

  // Remove a file from the current draft version only. Nothing is deleted from
  // storage or case_file; older versions that had the file keep it.
  router.delete('/:fileId', async (req, res, next) => {
    const caseId = parseCaseId(mountedCaseId(req))
    const fileId = parseCaseId(req.params.fileId)
    if (caseId === null || fileId === null) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    try {
      await withTransaction(async (client) => {
        const run: RunQuery = (text, values) => client.query(text, values)
        const versionId = requireDraft(await currentVersion(run, caseId, true))
        const removed = await client.query(
          'DELETE FROM case_version_file WHERE case_version_id = $1 AND case_file_id = $2 AND case_id = $3',
          [versionId, fileId, caseId],
        )
        if (removed.rowCount === 0) throw new HttpError(404, 'not_found')
      })
      res.status(204).end()
    } catch (error) {
      sendError(res, error, next)
    }
  })

  return router
}
