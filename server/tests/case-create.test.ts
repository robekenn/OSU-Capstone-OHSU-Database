import express from 'express'
import request from 'supertest'
import { beforeEach, expect, test, vi } from 'vitest'

// No real database here: the transaction helper is replaced so these tests can check the
// request rules (what is rejected before anything is written). What gets saved, and the
// find-or-create behavior, is tested against real PostgreSQL in case-filters.test.ts.
const { clientQuery, withTransaction } = vi.hoisted(() => {
  const clientQuery = vi.fn()
  const withTransaction = vi.fn(async (work: (client: { query: typeof clientQuery }) => unknown) => work({ query: clientQuery }))
  return { clientQuery, withTransaction }
})
vi.mock('../src/db.js', () => ({ pool: { query: vi.fn() }, withTransaction }))
import { casesRouter } from '../src/routes/cases.js'
import { tidy, uniqueNames } from '../src/caseLinks.js'

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

function sqlRun() {
  return clientQuery.mock.calls.map(([sql]) => String(sql))
}

test('a case with no campus, courses or outcomes saves without touching the lookup tables', async () => {
  const response = await request(app).post('/api/cases').send({ title: 'Synthetic case' })
  expect(response.status).toBe(201)
  expect(sqlRun().some((sql) => /campus|course|outcome|advisory/.test(sql))).toBe(false)
})

test('a case with a campus and courses saves, looking each one up inside the transaction', async () => {
  const response = await request(app).post('/api/cases').send({
    title: 'Synthetic case', campus: 'Synthetic Campus', courses: ['TEST 101'], outcomes: ['Synthetic outcome'],
  })
  expect(response.status).toBe(201)
  expect(withTransaction).toHaveBeenCalledTimes(1)
  expect(sqlRun().some((sql) => sql.includes('INSERT INTO case_use'))).toBe(true)
  expect(sqlRun().some((sql) => sql.includes('INSERT INTO case_version_outcome'))).toBe(true)
})

test('a campus without a course, or a course without a campus, is a 400 and writes nothing', async () => {
  const noCourse = await request(app).post('/api/cases').send({ title: 'Synthetic case', campus: 'Synthetic Campus' })
  expect(noCourse.status).toBe(400)
  expect(noCourse.body.fields).toEqual(['courses'])
  const noCampus = await request(app).post('/api/cases').send({ title: 'Synthetic case', courses: ['TEST 101'] })
  expect(noCampus.status).toBe(400)
  expect(noCampus.body.fields).toEqual(['campus'])
  expect(withTransaction).not.toHaveBeenCalled()
})

test.each([
  ['a blank campus', { campus: '   ', courses: ['TEST 101'] }],
  ['a blank course', { campus: 'Synthetic Campus', courses: [''] }],
  ['a course that is not text', { campus: 'Synthetic Campus', courses: [1] }],
  ['a blank outcome', { outcomes: ['  '] }],
  ['an over-long campus', { campus: 'x'.repeat(301), courses: ['TEST 101'] }],
])('%s is a 400 and writes nothing', async (_label, links) => {
  const response = await request(app).post('/api/cases').send({ title: 'Synthetic case', ...links })
  expect(response.status).toBe(400)
  expect(withTransaction).not.toHaveBeenCalled()
})

test('tidy removes extra spaces, and uniqueNames keeps each entry once ignoring capitals', () => {
  expect(tidy('  NRS   424 ')).toBe('NRS 424')
  expect(uniqueNames(['NRS 424', 'nrs  424', ' NRS 425', '', '   '])).toEqual(['NRS 424', 'NRS 425'])
  expect(uniqueNames([])).toEqual([])
})