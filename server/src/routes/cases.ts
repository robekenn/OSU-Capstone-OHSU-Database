import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db.js'

// Everything the browser sends is checked here before it touches the database.
const createCaseBody = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.record(z.string(), z.unknown()).default({}),
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
})

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
    const { search, course = null, campus = null, outcome = null } = parsed.data

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
           LEFT JOIN case_version v ON v.id = c.current_version_id
          WHERE ($1::text IS NULL
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
        [pattern, course, campus, outcome],
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
        `SELECT c.id, c.title, v.id AS "versionId", v.version_number AS "versionNumber",
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
      res.json({ id: row.id, title: row.title, currentVersion: row.versionId === null ? null : {
        id: row.versionId, versionNumber: row.versionNumber, status: row.status,
        createdAt: row.createdAt, content: row.content,
      } })
    } catch (error) {
      next(error)
    }
  })

  // Create a case as a draft: one sim_case row plus its version 1, all-or-nothing.
  router.post('/', async (req, res, next) => {
    const parsed = createCaseBody.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', issues: parsed.error.issues })
      return
    }
    const { title, content } = parsed.data

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
        return { id: caseId, versionId }
      })
      res.status(201).json(created)
    } catch (error) {
      next(error)
    }
  })

  return router
}
