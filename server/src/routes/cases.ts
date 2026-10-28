import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db.js'

// Everything the browser sends is checked here before it touches the database.
const createCaseBody = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.record(z.string(), z.unknown()).default({}),
})

const listQuery = z.object({
  search: z.string().trim().max(200).optional(),
})

export function casesRouter() {
  const router = Router()

  // List cases. With ?search=word, matches the title or anything inside the case content.
  router.get('/', async (req, res, next) => {
    const parsed = listQuery.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }

    // Turn the search word into a LIKE pattern. % and _ are wildcards in LIKE,
    // so escape them (and the backslash) so they match as plain characters.
    const search = parsed.data.search
    let pattern: string | null = null
    if (search) {
      pattern = '%' + search.replace(/[\\%_]/g, '\\$&') + '%'
    }

    try {
      const result = await pool.query(
        `SELECT c.id,
                c.title,
                v.status,
                v.created_at AS "updatedAt"
           FROM sim_case c
           LEFT JOIN case_version v ON v.id = c.current_version_id
          WHERE $1::text IS NULL
             OR c.title ILIKE $1
             OR v.content::text ILIKE $1
          ORDER BY v.created_at DESC NULLS LAST, c.id DESC`,
        [pattern],
      )
      res.json(result.rows)
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
        const caseResult = await client.query('INSERT INTO sim_case (title) VALUES ($1) RETURNING id', [title])
        const caseId: number = caseResult.rows[0].id

        const versionResult = await client.query(
          `INSERT INTO case_version (case_id, version_number, status, content)
           VALUES ($1, 1, 'draft', $2) RETURNING id`,
          [caseId, JSON.stringify(content)],
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