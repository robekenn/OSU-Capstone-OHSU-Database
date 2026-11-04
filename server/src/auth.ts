import type { NextFunction, Request, Response } from 'express'
import { withTransaction } from './db.js'
import type { SystemRole } from './authorization.js'

type SupabaseIdentity = {
  id: string
  email?: string
  user_metadata?: { full_name?: string; name?: string }
}

export type AuthenticatedUser = {
  id: number
  subject: string
  email: string
  name: string
  systemRole: SystemRole
}

function authConfiguration() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

async function verifyToken(token: string): Promise<SupabaseIdentity | null> {
  const config = authConfiguration()
  if (!config) throw new Error('Supabase authentication is not configured')

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.key, Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return response.json() as Promise<SupabaseIdentity>
}

async function findOrCreateUser(identity: SupabaseIdentity): Promise<AuthenticatedUser> {
  if (!identity.email) throw new Error('Authenticated identity does not have an email address')
  const email = identity.email.trim().toLowerCase()
  const name = identity.user_metadata?.full_name?.trim()
    || identity.user_metadata?.name?.trim()
    || email.split('@')[0]

  return withTransaction(async (client) => {
    // Serializes first-user bootstrap. Only the first mapped identity can become Owner.
    await client.query('SELECT pg_advisory_xact_lock($1)', [7142026])
    const existing = await client.query(
      `SELECT id, oidc_subject, email, name, system_role
         FROM app_user
        WHERE oidc_subject = $1 OR lower(email) = $2
        ORDER BY oidc_subject = $1 DESC
        LIMIT 1`,
      [identity.id, email],
    )

    let row = existing.rows[0]
    if (row) {
      const mappedUsers = await client.query(
        'SELECT count(*)::int AS count FROM app_user WHERE oidc_subject IS NOT NULL',
      )
      const firstMappedUser = !row.oidc_subject && mappedUsers.rows[0].count === 0
      const updated = await client.query(
        `UPDATE app_user
            SET oidc_subject = $1, email = $2, name = $3,
                system_role = CASE WHEN $5 THEN 'owner' ELSE system_role END
          WHERE id = $4
          RETURNING id, oidc_subject, email, name, system_role`,
        [identity.id, email, name, row.id, firstMappedUser],
      )
      row = updated.rows[0]
    } else {
      const count = await client.query(
        'SELECT count(*)::int AS count FROM app_user WHERE oidc_subject IS NOT NULL',
      )
      const systemRole: SystemRole = count.rows[0].count === 0 ? 'owner' : 'user'
      const inserted = await client.query(
        `INSERT INTO app_user (oidc_subject, name, email, role, system_role)
         VALUES ($1, $2, $3, 'user', $4)
         RETURNING id, oidc_subject, email, name, system_role`,
        [identity.id, name, email, systemRole],
      )
      row = inserted.rows[0]
    }

    return {
      id: row.id,
      subject: row.oidc_subject,
      email: row.email,
      name: row.name,
      systemRole: row.system_role,
    }
  })
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'authentication_required' })
    return
  }

  try {
    const identity = await verifyToken(token)
    if (!identity) {
      res.status(401).json({ error: 'invalid_token' })
      return
    }
    req.user = await findOrCreateUser(identity)
    next()
  } catch (error) {
    next(error)
  }
}

export function requireAdministrator(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.systemRole === 'user') {
    res.status(403).json({ error: 'insufficient_permission' })
    return
  }
  next()
}
