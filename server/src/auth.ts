import type { RequestHandler } from 'express'
import { z } from 'zod'
import { pool } from './db.js'

const identity = z.object({ id: z.uuid() })

export const requireInstructor: RequestHandler = async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  const token = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') ?? '')?.[1]
  if (!token) {
    res.status(401).json({ error: 'authentication_required' })
    return
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
    ?? process.env.VITE_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    res.status(503).json({ error: 'authentication_unavailable' })
    return
  }

  let subject: string
  try {
    const response = await fetch(new URL('/auth/v1/user', url), {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    })
    if (response.status === 401 || response.status === 403) {
      res.status(401).json({ error: 'invalid_session' })
      return
    }
    if (!response.ok) throw new Error('Identity provider unavailable')
    subject = identity.parse(await response.json()).id
  } catch {
    res.status(503).json({ error: 'authentication_unavailable' })
    return
  }

  // The provisioning record is authoritative. Never enroll by signing in,
  // trusting token metadata, or matching a mutable email address.
  try {
    const result = await pool.query<{ id: number }>(
      "SELECT id FROM app_user WHERE oidc_subject = $1 AND role = 'instructor'",
      [subject],
    )
    if (!result.rows[0]) {
      res.status(403).json({ error: 'instructor_access_required' })
      return
    }
    res.locals.instructorId = result.rows[0].id
    next()
  } catch (error) {
    next(error)
  }
}
