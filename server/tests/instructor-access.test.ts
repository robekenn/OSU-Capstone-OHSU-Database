import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { query, getIdentity } = vi.hoisted(() => ({ query: vi.fn(), getIdentity: vi.fn() }))
vi.mock('../src/db.js', () => ({ pool: { query }, withTransaction: vi.fn() }))
import { createApp } from '../src/app.js'

const app = createApp()
const subject = 'b3c743ae-fb5e-4626-a1a0-f284a779cc9f'
const authorization = 'Bearer synthetic-session'

beforeEach(() => {
  query.mockReset()
  getIdentity.mockReset()
  vi.stubGlobal('fetch', getIdentity)
  vi.stubEnv('SUPABASE_URL', 'https://identity.example.test')
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-placeholder')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test('health stays public; every case, filter, and profile endpoint requires a session', async () => {
  expect((await request(app).get('/api/health')).status).toBe(200)
  for (const path of ['/api/cases', '/api/cases/1', '/api/courses', '/api/campuses', '/api/outcomes', '/api/auth/me']) {
    expect((await request(app).get(path)).status).toBe(401)
  }
  expect((await request(app).post('/api/cases').send({ title: 'Synthetic' })).status).toBe(401)
  expect(getIdentity).not.toHaveBeenCalled()
  expect(query).not.toHaveBeenCalled()
})

test('invalid and unavailable identity provider responses fail closed', async () => {
  getIdentity.mockResolvedValueOnce(new Response(null, { status: 401 }))
  getIdentity.mockResolvedValueOnce(new Response(null, { status: 503 }))
  for (const expected of [401, 503]) {
    expect((await request(app).get('/api/cases').set('Authorization', authorization)).status).toBe(expected)
  }
  expect(query).not.toHaveBeenCalled()
})

test('a valid identity cannot self-enroll or assert its own role', async () => {
  getIdentity.mockResolvedValueOnce(Response.json({
    id: subject, email: 'synthetic@example.test', user_metadata: { role: 'instructor' },
  }))
  query.mockResolvedValueOnce({ rows: [] })
  const response = await request(app).get('/api/cases').set('Authorization', authorization)
  expect(response.status).toBe(403)
  expect(query).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/SELECT.*oidc_subject.*role = 'instructor'/), [subject])
})

test('a provisioned instructor can access the app, but not the removed admin or signup APIs', async () => {
  getIdentity.mockImplementation(async () => Response.json({ id: subject }))
  query.mockResolvedValue({ rows: [{ id: 27 }] })
  const profile = await request(app).get('/api/auth/me').set('Authorization', authorization)
  expect(profile.status).toBe(200)
  expect(profile.body).toEqual({ id: 27 })
  expect(profile.headers['cache-control']).toBe('private, no-store')
  expect(getIdentity).toHaveBeenCalledWith(new URL('https://identity.example.test/auth/v1/user'),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: authorization }) }))
  expect((await request(app).get('/api/admin/users').set('Authorization', authorization)).status).toBe(404)
  expect((await request(app).post('/api/auth/signup').set('Authorization', authorization)).status).toBe(404)
})
