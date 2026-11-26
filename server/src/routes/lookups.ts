import { Router } from 'express'
import { pool } from '../db.js'

// Read-only lists the Cases page and the New case form use for their dropdowns and
// suggestions. Nobody seeds these tables: saving a case adds any new campus, course or
// outcome it names (see saveCaseLinks). Each list returns only the values that at least
// one case uses, so the dropdowns always reflect the cases that exist.
export function lookupsRouter() {
  const router = Router()

  router.get('/courses', async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT c.id, c.code, c.title
           FROM course c
          WHERE EXISTS (SELECT 1 FROM case_use u WHERE u.course_id = c.id)
          ORDER BY c.code, c.id`,
      )
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  router.get('/campuses', async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT c.id, c.name
           FROM campus c
          WHERE EXISTS (SELECT 1 FROM case_use u WHERE u.campus_id = c.id)
          ORDER BY c.name, c.id`,
      )
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  // Only the current version's outcomes count, because that is what the outcome filter matches.
  router.get('/outcomes', async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT o.id, o.framework, o.code, o.description
           FROM outcome o
          WHERE EXISTS (SELECT 1
                          FROM sim_case s
                          JOIN case_version_outcome m ON m.case_version_id = s.current_version_id
                         WHERE m.outcome_id = o.id)
          ORDER BY o.framework, o.code NULLS LAST, o.description, o.id`,
      )
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  return router
}