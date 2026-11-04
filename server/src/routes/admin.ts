import { Router } from 'express'
import { z } from 'zod'
import { canAssignRole } from '../authorization.js'
import { requireAdministrator, requireAuth } from '../auth.js'
import { pool, withTransaction } from '../db.js'

const roleBody = z.object({
  systemRole: z.enum(['user', 'admin', 'owner']),
})

export function adminRouter() {
  const router = Router()
  router.use(requireAuth, requireAdministrator)

  router.get('/users', async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id, name, email, system_role AS "systemRole"
           FROM app_user
          ORDER BY name, id`,
      )
      res.json(result.rows)
    } catch (error) {
      next(error)
    }
  })

  router.patch('/users/:id/role', async (req, res, next) => {
    const id = Number(req.params.id)
    const parsed = roleBody.safeParse(req.body)
    if (!Number.isSafeInteger(id) || id <= 0 || !parsed.success) {
      res.status(400).json({ error: 'invalid_request' })
      return
    }

    try {
      const updated = await withTransaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock($1)', [7142026])
        const targetResult = await client.query(
          'SELECT id, system_role FROM app_user WHERE id = $1 FOR UPDATE',
          [id],
        )
        const target = targetResult.rows[0]
        if (!target) return { status: 404 as const }

        if (!canAssignRole(req.user!.systemRole, target.system_role, parsed.data.systemRole)) {
          return { status: 403 as const }
        }

        if (target.system_role === 'owner' && parsed.data.systemRole !== 'owner') {
          const owners = await client.query(
            `SELECT count(*)::int AS count FROM app_user WHERE system_role = 'owner'`,
          )
          if (owners.rows[0].count <= 1) return { status: 409 as const }
        }

        const result = await client.query(
          `UPDATE app_user SET system_role = $1 WHERE id = $2
           RETURNING id, name, email, system_role AS "systemRole"`,
          [parsed.data.systemRole, id],
        )
        return { status: 200 as const, user: result.rows[0] }
      })

      if (updated.status === 404) res.status(404).json({ error: 'user_not_found' })
      else if (updated.status === 403) res.status(403).json({ error: 'insufficient_permission' })
      else if (updated.status === 409) res.status(409).json({ error: 'last_owner_required' })
      else res.json(updated.user)
    } catch (error) {
      next(error)
    }
  })

  return router
}
