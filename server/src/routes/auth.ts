import { Router } from 'express'
import { requireAuth } from '../auth.js'

export function authRouter() {
  const router = Router()

  router.get('/me', requireAuth, (req, res) => {
    res.json(req.user)
  })

  return router
}
