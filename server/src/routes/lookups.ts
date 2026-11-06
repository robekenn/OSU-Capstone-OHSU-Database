import { Router } from 'express'
import { pool } from '../db.js'

// Read-only lists the Cases page uses to build its filter dropdowns.
// Each returns every row; these tables are small reference lists, not case data.
export function lookupsRouter() {
  const router = Router()

  router.get('/courses', async (_req, res, next) => {
    try {
      const result = await pool.query('SELECT id, code, title FROM course ORDER BY code, id')
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  router.get('/campuses', async (_req, res, next) => {
    try {
      const result = await pool.query('SELECT id, name FROM campus ORDER BY name, id')
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  router.get('/outcomes', async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id, framework, code, description
           FROM outcome
          ORDER BY framework, code NULLS LAST, description, id`,
      )
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  return router
}
