import express from 'express'
import { requireInstructor } from './auth.js'
import { casesRouter } from './routes/cases.js'
import { lookupsRouter } from './routes/lookups.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', requireInstructor)
  app.get('/api/auth/me', (_req, res) => {
    res.json({ id: res.locals.instructorId })
  })
  app.use('/api/cases', casesRouter())
  app.use('/api', lookupsRouter())

  // Any other /api URL gets a 404 as JSON.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  // Catches errors thrown in routes. It never sends details back or logs request bodies,
  // because those can hold case content.
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled API error')
    res.status(500).json({ error: 'internal_error' })
  })

  return app
}

// Vercel's Express runtime loads the default export as the request handler.
export default createApp()
