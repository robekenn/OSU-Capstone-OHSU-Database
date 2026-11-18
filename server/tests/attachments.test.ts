import { createHash } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { beforeEach, expect, test, vi } from 'vitest'
import { TooLargeError } from '../src/attachments/storage.js'
import type { FileStorage } from '../src/attachments/storage.js'

const { query, clientQuery } = vi.hoisted(() => ({ query: vi.fn(), clientQuery: vi.fn() }))
vi.mock('../src/db.js', () => ({
  pool: { query },
  // Runs the work like the real helper; a throw stands for ROLLBACK (nothing kept).
  withTransaction: async (work: (client: { query: typeof clientQuery }) => Promise<unknown>) => work({ query: clientQuery }),
}))
import { attachmentsRouter, carryForwardAttachments } from '../src/routes/attachments.js'

// An in-memory stand-in for private object storage. Every file here is fictional.
function fakeStorage() {
  const objects = new Map<string, { bytes: Buffer; contentType: string; createdAt: Date }>()
  const storage: FileStorage = {
    createUploadUrl: vi.fn(async (key: string) => `https://storage.example.test/upload/${key}?token=synthetic`),
    read: vi.fn(async (key: string, maxBytes: number) => {
      const object = objects.get(key)
      if (!object) return null
      if (object.bytes.length > maxBytes) throw new TooLargeError()
      return { bytes: object.bytes, contentType: object.contentType }
    }),
    createDownloadUrl: vi.fn(async (key: string, filename: string, seconds: number) =>
      `https://storage.example.test/download/${key}?expires=${seconds}&download=${encodeURIComponent(filename)}`),
    remove: vi.fn(async (keys: string[]) => { for (const key of keys) objects.delete(key) }),
    list: vi.fn(async (folder: string) => [...objects.entries()]
      .filter(([key]) => key.startsWith(folder + '/'))
      .map(([key, object]) => ({ key, createdAt: object.createdAt }))),
  }
  // What the browser's PUT to the signed upload link does.
  const put = (key: string, bytes: Buffer, contentType: string, createdAt = new Date()) =>
    objects.set(key, { bytes, contentType, createdAt })
  return { storage, objects, put }
}

let fake = fakeStorage()
let storageEnabled = true
const app = express()
app.use(express.json())
app.use((_req, res, next) => { res.locals.instructorId = 41; next() })
app.use('/api/cases/:caseId/attachments', attachmentsRouter(() => (storageEnabled ? fake.storage : null)))
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: 'internal_error' })
})

const PDF = 'application/pdf'
const syntheticPdf = Buffer.from('%PDF-1.7\n% Synthetic debriefing handout. Fictional content only.\n%%EOF\n')
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const savedFile = { id: 31, filename: 'Synthetic handout.pdf', mediaType: PDF,
  sizeBytes: syntheticPdf.length, sha256: sha256(syntheticPdf), uploadedAt: '2026-11-17T12:00:00.000Z' }

// Case 7's current version 9 is a draft unless a test says otherwise.
let versionStatus = 'draft'
function answer(sql: string, params: unknown[] = []) {
  if (/FROM sim_case c/.test(sql) && /COALESCE/.test(sql)) {
    return { rows: [{ versionId: params[1] ?? 9, status: params[1] === 5 ? 'approved' : versionStatus, isCurrent: params[1] === undefined || params[1] === null }] }
  }
  if (/FROM sim_case c/.test(sql)) return { rows: [{ versionId: 9, status: versionStatus }] }
  if (/SELECT 1 FROM case_file WHERE storage_key/.test(sql)) return { rows: [] }
  if (/SELECT storage_key FROM case_file/.test(sql)) return { rows: [] }
  if (/INSERT INTO case_file/.test(sql)) return { rows: [savedFile] }
  if (/INSERT INTO case_version_file/.test(sql)) return { rows: [], rowCount: 1 }
  if (/DELETE FROM case_version_file/.test(sql)) return { rows: [], rowCount: params[1] === 31 ? 1 : 0 }
  if (/FROM case_version_file l\s+JOIN case_file f/.test(sql)) return { rows: [savedFile] }
  if (/SELECT f\.storage_key/.test(sql)) {
    return { rows: params[1] === 31 ? [{ storage_key: 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c', original_filename: savedFile.filename }] : [] }
  }
  throw new Error('Unexpected query in test: ' + sql)
}

beforeEach(() => {
  fake = fakeStorage()
  storageEnabled = true
  versionStatus = 'draft'
  query.mockReset().mockImplementation(async (sql: string, params?: unknown[]) => answer(sql, params))
  clientQuery.mockReset().mockImplementation(async (sql: string, params?: unknown[]) => answer(sql, params))
})

async function requestUpload(filename = savedFile.filename, sizeBytes = syntheticPdf.length) {
  return request(app).post('/api/cases/7/attachments/uploads').send({ filename, sizeBytes })
}

test('an allowed file uploads, is listed, and downloads with the same checksum', async () => {
  const signed = await requestUpload()
  expect(signed.status).toBe(201)
  expect(signed.body).toMatchObject({ mediaType: PDF, maxBytes: 26214400 })
  expect(signed.body.uploadKey).toMatch(/^cases\/7\/[0-9a-f-]{36}$/)
  expect(signed.body.uploadUrl).toContain(signed.body.uploadKey)

  fake.put(signed.body.uploadKey, syntheticPdf, PDF)
  const saved = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: signed.body.uploadKey, filename: savedFile.filename, sha256: sha256(syntheticPdf) })
  expect(saved.status).toBe(201)
  expect(saved.body).toEqual(savedFile)

  const insert = clientQuery.mock.calls.find(([sql]) => /INSERT INTO case_file/.test(sql))
  expect(insert?.[1]).toEqual([7, signed.body.uploadKey, savedFile.filename, PDF, syntheticPdf.length, sha256(syntheticPdf), 41])
  const link = clientQuery.mock.calls.find(([sql]) => /INSERT INTO case_version_file/.test(sql))
  expect(link?.[1]).toEqual([9, 31, 7])
  // The version is locked while the file is recorded, so a concurrent edit can't slip in.
  expect(clientQuery.mock.calls[0][0]).toMatch(/FOR UPDATE OF c/)

  const list = await request(app).get('/api/cases/7/attachments')
  expect(list.body).toEqual({ versionId: 9, editable: true, files: [savedFile] })

  const download = await request(app).get('/api/cases/7/attachments/31/download')
  expect(download.status).toBe(200)
  expect(download.body.expiresInSeconds).toBe(60)
  expect(download.body.url).toContain('download=Synthetic%20handout.pdf')
  expect(sha256(fake.objects.get(signed.body.uploadKey)!.bytes)).toBe(saved.body.sha256)
})

test('disallowed types and oversized files are refused before anything is stored', async () => {
  for (const filename of ['page.html', 'tool.exe', 'macros.docm', 'no-extension']) {
    const response = await requestUpload(filename)
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'unsupported_type' })
  }
  const big = await requestUpload('Synthetic slides.pptx', 26214401)
  expect(big.body).toEqual({ error: 'file_too_large' })
  expect(fake.storage.createUploadUrl).not.toHaveBeenCalled()
  expect(fake.objects.size).toBe(0)
})

test('a stored file whose bytes are not what its name claims is deleted and never recorded', async () => {
  const key = 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c'
  const disguised = Buffer.from('<html><script>synthetic</script></html>')
  fake.put(key, disguised, PDF)
  const response = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: key, filename: 'looks-like.pdf', sha256: sha256(disguised) })
  expect(response.status).toBe(400)
  expect(response.body).toEqual({ error: 'unsupported_type' })
  expect(fake.objects.has(key)).toBe(false)
  expect(clientQuery).not.toHaveBeenCalled()
})

test('a stored Content-Type that disagrees with the file is refused', async () => {
  const key = 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c'
  fake.put(key, syntheticPdf, 'text/html')
  const response = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: key, filename: 'handout.pdf', sha256: sha256(syntheticPdf) })
  expect(response.body).toEqual({ error: 'unsupported_type' })
  expect(fake.objects.size).toBe(0)
})

test('an oversized stored object is deleted, even if the browser lied about its size', async () => {
  const key = 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c'
  fake.put(key, Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(26214400)]), PDF)
  const response = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: key, filename: 'big.pdf', sha256: 'a'.repeat(64) })
  expect(response.body).toEqual({ error: 'file_too_large' })
  expect(fake.objects.size).toBe(0)
  expect(clientQuery).not.toHaveBeenCalled()
})

test('a checksum mismatch (corrupted upload) leaves no row and no stored file', async () => {
  const key = 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c'
  fake.put(key, syntheticPdf, PDF)
  const response = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: key, filename: 'handout.pdf', sha256: 'b'.repeat(64) })
  expect(response.body).toEqual({ error: 'checksum_mismatch' })
  expect(fake.objects.size).toBe(0)
  expect(clientQuery).not.toHaveBeenCalled()
})

test('a database failure while recording deletes the stored object', async () => {
  const key = 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c'
  fake.put(key, syntheticPdf, PDF)
  clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (/INSERT INTO case_version_file/.test(sql)) throw new Error('Synthetic database failure')
    return answer(sql, params)
  })
  const response = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: key, filename: 'handout.pdf', sha256: sha256(syntheticPdf) })
  expect(response.status).toBe(500)
  expect(response.body).toEqual({ error: 'internal_error' })
  expect(fake.objects.size).toBe(0)
})

test('a repeated finalize does not delete the object the first one recorded', async () => {
  const key = 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c'
  fake.put(key, syntheticPdf, PDF)
  clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (/INSERT INTO case_file/.test(sql)) throw Object.assign(new Error('duplicate'), { code: '23505' })
    return answer(sql, params)
  })
  query.mockImplementation(async (sql: string, params?: unknown[]) =>
    /SELECT 1 FROM case_file WHERE storage_key/.test(sql) ? { rows: [{ '?column?': 1 }] } : answer(sql, params))
  const response = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: key, filename: 'handout.pdf', sha256: sha256(syntheticPdf) })
  expect(response.status).toBe(409)
  expect(fake.objects.has(key)).toBe(true)
})

test('upload keys must be ones this API issues for this case', async () => {
  fake.put('cases/8/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c', syntheticPdf, PDF)
  for (const uploadKey of ['cases/8/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c', '../cases/7/x', 'cases/7/not-a-uuid']) {
    const response = await request(app).post('/api/cases/7/attachments')
      .send({ uploadKey, filename: 'handout.pdf', sha256: sha256(syntheticPdf) })
    expect(response.status).toBe(400)
  }
  expect(fake.storage.read).not.toHaveBeenCalled()
  const missing = await request(app).post('/api/cases/7/attachments')
    .send({ uploadKey: 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c', filename: 'handout.pdf', sha256: sha256(syntheticPdf) })
  expect(missing.body).toEqual({ error: 'upload_not_found' })
})

test('only the current draft version can gain or lose files', async () => {
  versionStatus = 'approved'
  expect((await requestUpload()).body).toEqual({ error: 'version_not_editable' })
  expect((await request(app).delete('/api/cases/7/attachments/31')).status).toBe(409)
  expect(fake.storage.createUploadUrl).not.toHaveBeenCalled()
})

test('removing a file unlinks it from the current version only and deletes nothing stored', async () => {
  const response = await request(app).delete('/api/cases/7/attachments/31')
  expect(response.status).toBe(204)
  const removal = clientQuery.mock.calls.find(([sql]) => /DELETE/.test(sql))
  expect(removal?.[0]).toMatch(/DELETE FROM case_version_file WHERE case_version_id = \$1/)
  expect(removal?.[1]).toEqual([9, 31, 7])
  expect(fake.storage.remove).not.toHaveBeenCalled()
  expect((await request(app).delete('/api/cases/7/attachments/32')).status).toBe(404)
})

test('an older version still lists its own files and is read-only', async () => {
  const response = await request(app).get('/api/cases/7/attachments?versionId=5')
  expect(response.status).toBe(200)
  expect(response.body).toEqual({ versionId: 5, editable: false, files: [savedFile] })
  const filesQuery = query.mock.calls.find(([sql]) => /FROM case_version_file l/.test(sql))
  expect(filesQuery?.[1]).toEqual([5, 7])
})

test('downloads require a file that belongs to this case', async () => {
  expect((await request(app).get('/api/cases/7/attachments/99/download')).status).toBe(404)
  expect(fake.storage.createDownloadUrl).not.toHaveBeenCalled()
  const lookup = query.mock.calls.find(([sql]) => /SELECT f\.storage_key/.test(sql))
  expect(lookup?.[0]).toMatch(/f\.case_id = \$1/)
})

test('malformed ids are rejected and storage being unconfigured is a 503', async () => {
  for (const path of ['/api/cases/abc/attachments', '/api/cases/0/attachments', '/api/cases/7/attachments?versionId=x',
    '/api/cases/7/attachments/abc/download']) {
    expect((await request(app).get(path)).status).toBe(400)
  }
  storageEnabled = false
  expect((await requestUpload()).body).toEqual({ error: 'storage_unavailable' })
  expect((await request(app).get('/api/cases/7/attachments/31/download')).status).toBe(503)
})

test('abandoned uploads with no database row are swept, recent and recorded ones kept', async () => {
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000)
  fake.put('cases/7/00000000-0000-4000-8000-000000000001', syntheticPdf, PDF, hoursAgo(3)) // abandoned
  fake.put('cases/7/00000000-0000-4000-8000-000000000002', syntheticPdf, PDF, hoursAgo(3)) // recorded
  fake.put('cases/7/00000000-0000-4000-8000-000000000003', syntheticPdf, PDF, new Date()) // in progress
  query.mockImplementation(async (sql: string, params?: unknown[]) =>
    /SELECT storage_key FROM case_file/.test(sql)
      ? { rows: [{ storage_key: 'cases/7/00000000-0000-4000-8000-000000000002' }] }
      : answer(sql, params))
  expect((await requestUpload()).status).toBe(201)
  expect([...fake.objects.keys()].sort()).toEqual([
    'cases/7/00000000-0000-4000-8000-000000000002',
    'cases/7/00000000-0000-4000-8000-000000000003',
  ])
})

test('a new version can carry its predecessor\'s files forward', async () => {
  const run = vi.fn(async () => ({ rows: [] }))
  await carryForwardAttachments({ query: run } as never, 9, 10)
  expect(run).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO case_version_file[\s\S]*SELECT \$2, case_file_id, case_id/), [9, 10])
})
