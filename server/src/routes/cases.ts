import { Router } from 'express'
import { z } from 'zod'
import type { PoolClient } from 'pg'
import { pool, withTransaction } from '../db.js'
import { carryForwardAttachments } from './attachments.js'
import { saveCaseLinks } from '../caseLinks.js'

// Everything the browser sends is checked here before it touches the database.
// A campus or course as typed by the author, and an outcome statement.
const shortName = z.string().trim().min(1).max(300)
const outcomeName = z.string().trim().min(1).max(2000)

const createCaseBody = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.record(z.string(), z.unknown()).default({}),
  // Where the case is used and what it teaches, as typed. Saving creates any campus,
  // course or outcome that is not in its table yet, and links the case to each one,
  // so the Cases page filters can offer the values that cases actually use.
  // These are not part of `content`.
  campus: shortName.optional(),
  courses: z.array(shortName).max(50).default([]),
  outcomes: z.array(outcomeName).max(100).default([]),
})

// A filter id must be a plain positive whole number that fits a Postgres INT.
// Anything else (abc, 1.5, -1, an empty value, ?course=1&course=2) is a 400.
const filterId = z
  .string()
  .regex(/^[1-9][0-9]{0,9}$/)
  .transform(Number)
  .refine((id) => id <= 2_147_483_647)
  .optional()

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
  course: filterId,
  campus: filterId,
  outcome: filterId,
  archived: z.literal('1').optional(),
})

const fieldName = z.string().regex(/^[a-z][a-zA-Z0-9]*$/)
  .refine((key) => !['constructor', 'prototype'].includes(key))
const fieldValue = z.union([z.string(), z.array(z.string()), z.array(z.record(fieldName, z.string())), z.null()])
const versionBody = z.strictObject({
  expectedVersionId: z.number().int().positive().max(2_147_483_647),
  title: createCaseBody.shape.title,
  changes: z.record(fieldName, z.record(fieldName, fieldValue)),
})
const archiveBody = z.strictObject({ archived: z.boolean() })

// Lock before reading the version so a waiting edit sees the preceding save.
async function lockCase(client: PoolClient, id: number) {
  const result = await client.query<{ current_version_id: number | null; archived: boolean }>(
    'SELECT current_version_id, archived_at IS NOT NULL AS archived FROM sim_case WHERE id = $1 FOR UPDATE', [id],
  )
  return result.rows[0]
}

export function casesRouter() {
  const router = Router()

  // List cases (FR-6). Every parameter is optional and they combine with AND:
  //   ?search=word  matches the title or anything inside the current version's content
  //   ?course=id    the case is used in that course (case_use)
  //   ?campus=id    the case is used at that campus (case_use)
  //   ?outcome=id   the case's CURRENT version maps to that outcome; older versions don't count
  // With both course and campus, they must be on the same case_use row: the case
  // runs in that course at that campus, not in that course somewhere and at that
  // campus in some other course.
  router.get('/', async (req, res, next) => {
    const parsed = listQuery.safeParse(req.query)
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
      res.status(400).json({ error: 'invalid_request', fields })
      return
    }
    const { search, course = null, campus = null, outcome = null, archived } = parsed.data

    // Turn the search word into a LIKE pattern. % and _ are wildcards in LIKE,
    // so escape them (and the backslash) so they match as plain characters.
    let pattern: string | null = null
    if (search) {
      pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%'
    }

    try {
      // An id that is well formed but doesn't exist is the caller's mistake, so
      // it gets a 400 naming the field instead of a quietly empty list.
      if (course !== null || campus !== null || outcome !== null) {
        const check = await pool.query(
          `SELECT ($1::int IS NULL OR EXISTS (SELECT 1 FROM course  WHERE id = $1)) AS course,
                  ($2::int IS NULL OR EXISTS (SELECT 1 FROM campus  WHERE id = $2)) AS campus,
                  ($3::int IS NULL OR EXISTS (SELECT 1 FROM outcome WHERE id = $3)) AS outcome`,
          [course, campus, outcome],
        )
        const found: Record<string, boolean> = check.rows[0]
        const unknown = Object.keys(found).filter((field) => !found[field])
        if (unknown.length > 0) {
          res.status(400).json({ error: 'invalid_request', fields: unknown })
          return
        }
      }

      // EXISTS rather than JOIN, so a case used in several courses is still listed once.
      const result = await pool.query(
        `SELECT c.id,
                c.title,
                v.status,
                v.created_at AS "updatedAt"
           FROM sim_case c
           LEFT JOIN case_version v ON v.id = c.current_version_id AND v.case_id = c.id
          WHERE (c.archived_at IS NOT NULL) = $5::boolean
            AND ($1::text IS NULL
                 OR c.title ILIKE $1
                 OR v.content::text ILIKE $1)
            AND (($2::int IS NULL AND $3::int IS NULL)
                 OR EXISTS (SELECT 1
                              FROM case_use u
                             WHERE u.case_id = c.id
                               AND ($2::int IS NULL OR u.course_id = $2)
                               AND ($3::int IS NULL OR u.campus_id = $3)))
            AND ($4::int IS NULL
                 OR EXISTS (SELECT 1
                              FROM case_version_outcome m
                             WHERE m.case_version_id = c.current_version_id
                               AND m.outcome_id = $4))
          ORDER BY v.created_at DESC NULLS LAST, c.id DESC`,
        [pattern, course, campus, outcome, archived === '1'],
      )
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  // Read only the version pointed to by this case. Never expose another case's version.
  router.get('/:caseId', async (req, res, next) => {
    const parsed = filterId.safeParse(req.params.caseId)
    if (!parsed.success || parsed.data === undefined) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    try {
      const result = await pool.query(
        `SELECT c.id, c.title, c.archived_at IS NOT NULL AS archived,
                v.id AS "versionId", v.version_number AS "versionNumber",
                v.status, v.created_at AS "createdAt", v.content
           FROM sim_case c
           LEFT JOIN case_version v ON v.id = c.current_version_id AND v.case_id = c.id
          WHERE c.id = $1`,
        [parsed.data],
      )
      const row = result.rows[0]
      if (!row) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.json({ id: row.id, title: row.title, archived: row.archived, currentVersion: row.versionId === null ? null : {
        id: row.versionId, versionNumber: row.versionNumber, status: row.status,
        createdAt: row.createdAt, content: row.content,
      } })
    } catch (error) {
      next(error)
    }
  })

  router.post('/:caseId/versions', async (req, res, next) => {
    const caseId = filterId.safeParse(req.params.caseId)
    const body = versionBody.safeParse(req.body)
    if (!caseId.success || caseId.data === undefined || !body.success) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    const id = caseId.data
    const { expectedVersionId, title, changes } = body.data
    try {
      const result = await withTransaction(async (client) => {
        const saved = await lockCase(client, id)
        if (!saved) return { status: 404, error: 'not_found' } as const
        if (saved.archived) return { status: 409, error: 'case_archived' } as const
        if (saved.current_version_id !== expectedVersionId) return { status: 409, error: 'stale_version' } as const
        // Keep the patch in PostgreSQL. Parsing the whole draft in JavaScript would
        // round large numbers in untouched legacy fields.
        const { rows: [version] } = await client.query<{ status: string; content: string | null; editable: boolean }>(
          `WITH prior AS (
             SELECT status, content, COALESCE(NULLIF(content, 'null'::jsonb), '{}'::jsonb) AS original
               FROM case_version WHERE id = $1 AND case_id = $2
           ), changes AS (
             SELECT key AS section, value AS fields FROM jsonb_each($3::jsonb)
           ), checked AS (
             SELECT *, $3::jsonb = '{}'::jsonb OR (jsonb_typeof(original) = 'object' AND NOT EXISTS (
               SELECT 1 FROM changes WHERE original ? section AND jsonb_typeof(original -> section) <> 'object'
             )) AS editable FROM prior
           )
           SELECT status, editable, (CASE
             WHEN $3::jsonb = '{}'::jsonb THEN content
             WHEN editable THEN (original - ARRAY(SELECT section FROM changes)) || COALESCE((
               SELECT jsonb_object_agg(section, patched) FILTER (WHERE patched <> '{}'::jsonb)
                 FROM changes CROSS JOIN LATERAL (
                   SELECT (COALESCE(original -> section, '{}'::jsonb) - ARRAY(SELECT jsonb_object_keys(fields)))
                     || jsonb_strip_nulls(fields) AS patched
                 ) AS patch
             ), '{}'::jsonb)
           END)::text AS content FROM checked`, [expectedVersionId, id, JSON.stringify(changes)],
        )
        if (version?.status !== 'draft') return { status: 409, error: 'version_not_editable' } as const
        if (!version.editable) return { status: 409, error: 'unsupported_content' } as const

        const { rows: [inserted] } = await client.query<{ id: number }>(
          `INSERT INTO case_version (case_id, version_number, status, content, created_by)
           SELECT $1, COALESCE(MAX(version_number), 0) + 1, 'draft', $2, $3
             FROM case_version WHERE case_id = $1 RETURNING id`,
          [id, version.content, res.locals.instructorId],
        )
        await client.query(`INSERT INTO case_version_tag (case_version_id, tag_id)
          SELECT $2, tag_id FROM case_version_tag WHERE case_version_id = $1`, [expectedVersionId, inserted.id])
        await client.query(`INSERT INTO case_version_outcome (case_version_id, outcome_id)
          SELECT $2, outcome_id FROM case_version_outcome WHERE case_version_id = $1`, [expectedVersionId, inserted.id])
        await carryForwardAttachments(client, expectedVersionId, inserted.id)
        await client.query('UPDATE sim_case SET title = $2, current_version_id = $3 WHERE id = $1', [id, title, inserted.id])
        return { status: 201, versionId: inserted.id } as const
      })
      if (result.status === 201) res.status(201).json({ id, versionId: result.versionId })
      else res.status(result.status).json({ error: result.error })
    } catch (error) {
      next(error)
    }
  })

  router.patch('/:caseId/archive', async (req, res, next) => {
    const caseId = filterId.safeParse(req.params.caseId)
    const body = archiveBody.safeParse(req.body)
    if (!caseId.success || caseId.data === undefined || !body.success) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }
    const id = caseId.data
    const { archived } = body.data
    try {
      const status = await withTransaction(async (client) => {
        const saved = await lockCase(client, id)
        if (!saved) return 404
        if (saved.archived === archived) return 204
        if (archived) {
          const { rows: [version] } = await client.query<{ status: string }>(
            'SELECT status FROM case_version WHERE id = $1 AND case_id = $2', [saved.current_version_id, id],
          )
          if (version?.status !== 'draft') return 409
        }
        await client.query('UPDATE sim_case SET archived_at = CASE WHEN $2::boolean THEN now() ELSE NULL END WHERE id = $1', [id, archived])
        return 204
      })
      if (status === 204) res.status(204).end()
      else res.status(status).json({ error: status === 404 ? 'not_found' : 'version_not_editable' })
    } catch (error) {
      next(error)
    }
  })

  // Create a case as a draft: one sim_case row plus its version 1, all-or-nothing.
  // If a campus, courses or outcomes are given, they are linked to the case in the same
  // transaction (see saveCaseLinks), so the Cases page filters can find the case.
  router.post('/', async (req, res, next) => {
    const parsed = createCaseBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', issues: parsed.error.issues })
      return
    }
    const { title, content, campus, courses, outcomes } = parsed.data

    // case_use needs a campus AND a course on every row, so one without the
    // other can't be saved. Say so instead of quietly dropping it.
    if (courses.length > 0 && campus === undefined) {
      res.status(400).json({ error: 'invalid_request', fields: ['campus'] })
      return
    }
    if (campus !== undefined && courses.length === 0) {
      res.status(400).json({ error: 'invalid_request', fields: ['courses'] })
      return
    }

    try {
      const created = await withTransaction(async (client) => {
        const instructorId: number = res.locals.instructorId
        const caseResult = await client.query(
          'INSERT INTO sim_case (title, owner_id) VALUES ($1, $2) RETURNING id',
          [title, instructorId],
        )
        const caseId: number = caseResult.rows[0].id

        const versionResult = await client.query(
          `INSERT INTO case_version (case_id, version_number, status, content, created_by)
           VALUES ($1, 1, 'draft', $2, $3) RETURNING id`,
          [caseId, JSON.stringify(content), instructorId],
        )
        const versionId: number = versionResult.rows[0].id

        await client.query('UPDATE sim_case SET current_version_id = $1 WHERE id = $2', [versionId, caseId])

        await saveCaseLinks(client, caseId, versionId, { campus, courses, outcomes })

        return { id: caseId, versionId }
      })
      res.status(201).json(created)
    } catch (error) {
      next(error)
    }
  })

  return router
}