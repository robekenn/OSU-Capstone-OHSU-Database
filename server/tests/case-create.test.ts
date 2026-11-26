import express from 'express'
import request from 'supertest'
import { beforeEach, expect, test, vi } from 'vitest'

// No real database: the transaction helper is replaced so the test can see which
// SQL the route runs inside it, and in what order.
const { clientQuery, withTransaction } = vi.hoisted(() => {
  const clientQuery = vi.fn()
  const withTransaction = vi.fn(async (work: (client: { query: typeof clientQuery }) => unknown) => work({ query: clientQuery }))
  return { clientQuery, withTransaction }
})
vi.mock('../src/db.js', () => ({ pool: { query: vi.fn() }, withTransaction }))
import { casesRouter } from '../src/routes/cases.js'

const app = express()
app.use(express.json())
app.use((_req, res, next) => { res.locals.instructorId = 1; next() })
app.use('/api/cases', casesRouter())
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: 'internal_error' })
})

beforeEach(() => {
  clientQuery.mockReset()
  withTransaction.mockClear()
  clientQuery.mockResolvedValue({ rows: [{ id: 10 }] })
})

// The [sql, params] pairs of every INSERT the route ran.
function inserts(table: string) {
  return clientQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO ' + table))
}

test('saves one case_use row per course and one mapping row per outcome', async () => {
  const response = await request(app).post('/api/cases').send({
    title: 'Synthetic case', campusId: 1, courseIds: [2, 3], outcomeIds: [4],
  })
  expect(response.status).toBe(201)
  expect(inserts('case_use').map(([, params]) => params)).toEqual([[10, 1, 2], [10, 1, 3]])
  expect(inserts('case_version_outcome').map(([, params]) => params)).toEqual([[10, 4]])
})

test('a repeated id is saved once', async () => {
  const response = await request(app).post('/api/cases').send({
    title: 'Synthetic case', campusId: 1, courseIds: [2, 2], outcomeIds: [4, 4],
  })
  expect(response.status).toBe(201)
  expect(inserts('case_use')).toHaveLength(1)
  expect(inserts('case_version_outcome')).toHaveLength(1)
})

test('a case with no campus, course or outcome still saves', async () => {
  const response = await request(app).post('/api/cases').send({ title: 'Synthetic case' })
  expect(response.status).toBe(201)
  expect(inserts('case_use')).toHaveLength(0)
  expect(inserts('case_version_outcome')).toHaveLength(0)
})

test('a campus without a course, or a course without a campus, is a 400 and writes nothing', async () => {
  const noCourse = await request(app).post('/api/cases').send({ title: 'Synthetic case', campusId: 1 })
  expect(noCourse.status).toBe(400)
  expect(noCourse.body.fields).toEqual(['courseIds'])
  const noCampus = await request(app).post('/api/cases').send({ title: 'Synthetic case', courseIds: [2] })
  expect(noCampus.status).toBe(400)
  expect(noCampus.body.fields).toEqual(['campusId'])
  expect(withTransaction).not.toHaveBeenCalled()
})

test('malformed ids are a 400 and write nothing', async () => {
  const response = await request(app).post('/api/cases').send({
    title: 'Synthetic case', campusId: 1, courseIds: ['abc'],
  })
  expect(response.status).toBe(400)
  expect(withTransaction).not.toHaveBeenCalled()
})

test('an id that is not in its table (foreign key error) is a 400', async () => {
  withTransaction.mockRejectedValueOnce(Object.assign(new Error('synthetic foreign key error'), { code: '23503' }))
  const response = await request(app).post('/api/cases').send({
    title: 'Synthetic case', campusId: 999, courseIds: [2],
  })
  expect(response.status).toBe(400)
  expect(response.body.error).toBe('invalid_request')
})