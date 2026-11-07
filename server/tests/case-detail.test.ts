import express from 'express'
import request from 'supertest'
import { beforeEach, expect, test, vi } from 'vitest'

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../src/db.js', () => ({ pool: { query }, withTransaction: vi.fn() }))
import { casesRouter } from '../src/routes/cases.js'

const app = express()
app.use(express.json())
app.use('/api/cases', casesRouter())
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: 'internal_error' })
})
beforeEach(() => { query.mockReset() })

test('GET detail returns the current version without changing data', async () => {
  query.mockResolvedValue({ rows: [{ id: 7, title: 'Synthetic case', versionId: 9,
    versionNumber: 1, status: 'draft', createdAt: '2026-11-06T12:00:00Z',
    content: { roles: { participantCounts: '6-10' } } }] })
  const response = await request(app).get('/api/cases/7')
  expect(response.status).toBe(200)
  expect(response.body).toEqual({ id: 7, title: 'Synthetic case', currentVersion: {
    id: 9, versionNumber: 1, status: 'draft', createdAt: '2026-11-06T12:00:00Z',
    content: { roles: { participantCounts: '6-10' } },
  } })
  expect(query).toHaveBeenCalledTimes(1)
  expect(query.mock.calls[0][1]).toEqual([7])
  expect(query.mock.calls[0][0]).toMatch(/v\.case_id\s*=\s*c\.id/)
  expect(query.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE|DELETE/)
})

test('rejects malformed IDs before querying, and returns 404 for a missing case', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '2147483648']) {
    expect((await request(app).get('/api/cases/' + id)).status).toBe(400)
  }
  expect(query).not.toHaveBeenCalled()
  query.mockResolvedValue({ rows: [] })
  expect((await request(app).get('/api/cases/7')).status).toBe(404)
})

test('returns metadata when the case has no current version', async () => {
  query.mockResolvedValue({ rows: [{ id: 7, title: 'Synthetic unversioned case', versionId: null }] })
  const response = await request(app).get('/api/cases/7')
  expect(response.status).toBe(200)
  expect(response.body.currentVersion).toBeNull()
})

test('database failures do not expose SQL or connection details', async () => {
  query.mockImplementation(async () => { throw new Error('Synthetic internal database error') })
  const response = await request(app).get('/api/cases/7')
  expect(response.status).toBe(500)
  expect(response.body).toEqual({ error: 'internal_error' })
})
