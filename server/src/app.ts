import express from 'express'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { casesRouter } from './routes/cases.js'
import { requireAuth } from './auth.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter())
  app.use('/api/admin', adminRouter())
  app.use('/api/cases', requireAuth, casesRouter())

  // Any other /api URL gets a 404 as JSON.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  // Catches errors thrown in routes. It never sends details back or logs request bodies,
  // because those can hold case content.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('Unhandled error:', message)
    res.status(500).json({ error: 'internal_error' })
  })

  return app
}

// Vercel's Express runtime loads the default export as the request handler.
export default createApp()
