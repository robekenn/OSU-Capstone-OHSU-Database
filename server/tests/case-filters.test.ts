// Issue #39 / FR-6: GET /api/cases filters and the lookup lists behind the dropdowns.
//
// These run against a real, throwaway Postgres database named in TEST_DATABASE_URL.
// The suite wipes that database's public schema and reloads db/schema.sql, so the
// database name must end in "_test" or the suite refuses to run.
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/ohsu_sim_test npm test -w server
// Without TEST_DATABASE_URL the suite is skipped. All data below is synthetic.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import request from 'supertest'
import type { Express } from 'express'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { cleanContent } from '../../client/src/templates/cleanContent'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('GET /api/cases filters (FR-6)', () => {
  let app: Express
  let admin: pg.Client
  let closePool: () => Promise<void>

  beforeAll(async () => {
    const dbName = new URL(url!).pathname.slice(1)
    if (!dbName.endsWith('_test')) {
      throw new Error(`TEST_DATABASE_URL must name a database ending in _test (got "${dbName}")`)
    }

    admin = new pg.Client({ connectionString: url })
    await admin.connect()
    await admin.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await admin.query(readFileSync(resolve(__dirname, '../../db/schema.sql'), 'utf8'))

    // Same shape as db/tests/test_filters.sql, plus D (two uses) and E (no version).
    //   A: North / TEST 101, current v1 -> TF-1
    //   B: South / TEST 101, current v1 -> TF-2
    //   C: South / TEST 202, old v1 -> TF-1, current v2 -> TF-2
    //   D: North / TEST 202 and South / TEST 101, current v1 -> TF-1
    //   E: no version, no uses
    await admin.query(`
      INSERT INTO campus (id, name) VALUES (9401, 'Synthetic Campus North'), (9402, 'Synthetic Campus South');
      INSERT INTO course (id, code, title) VALUES (9501, 'TEST 101', 'Synthetic Course 101'), (9502, 'TEST 202', NULL);
      INSERT INTO outcome (id, framework, outcome_type, code, description) VALUES
        (9301, 'Test Framework', 'course', 'TF-1', 'Synthetic outcome 1'),
        (9302, 'Test Framework', 'course', 'TF-2', 'Synthetic outcome 2'),
        (9303, 'Another Framework', 'program', NULL, 'Synthetic outcome without a code');
      INSERT INTO sim_case (id, title) VALUES
        (9101, 'Case A'), (9102, 'Case B'), (9103, 'Case C'), (9104, 'Case D'), (9105, 'Case E 100% safe_mode');
      INSERT INTO case_version (id, case_id, version_number, content, created_at) VALUES
        (9201, 9101, 1, '{"topic": "Synthetic sepsis"}', '2026-01-01'),
        (9202, 9102, 1, '{"topic": "Synthetic asthma"}', '2026-01-02'),
        (9203, 9103, 1, '{"topic": "Synthetic sepsis"}', '2026-01-03'),
        (9204, 9103, 2, '{"topic": "Synthetic stroke"}', '2026-01-04'),
        (9205, 9104, 1, '{"topic": "Synthetic sepsis"}', '2026-01-05');
      UPDATE sim_case SET current_version_id = 9201 WHERE id = 9101;
      UPDATE sim_case SET current_version_id = 9202 WHERE id = 9102;
      UPDATE sim_case SET current_version_id = 9204 WHERE id = 9103;
      UPDATE sim_case SET current_version_id = 9205 WHERE id = 9104;
      INSERT INTO case_use (case_id, campus_id, course_id) VALUES
        (9101, 9401, 9501), (9102, 9402, 9501), (9103, 9402, 9502), (9104, 9401, 9502), (9104, 9402, 9501);
      INSERT INTO case_version_outcome (case_version_id, outcome_id) VALUES
        (9201, 9301), (9202, 9302), (9203, 9301), (9204, 9302), (9205, 9301);
    `)

    process.env.DATABASE_URL = url
    // Imported only now, because db.ts reads DATABASE_URL when it loads.
    const appModule = await import('../src/app.js')
    const dbModule = await import('../src/db.js')
    app = appModule.createApp()
    closePool = () => dbModule.pool.end()
  })

  afterAll(async () => {
    await closePool?.()
    await admin?.end()
  })

  async function titles(query: string): Promise<string[]> {
    const response = await request(app).get('/api/cases' + query)
    expect(response.status).toBe(200)
    return (response.body as { title: string }[]).map((row) => row.title).sort()
  }

  test('no filters lists every case once, including one with no version', async () => {
    expect(await titles('')).toEqual(['Case A', 'Case B', 'Case C', 'Case D', 'Case E 100% safe_mode'])
  })

  test('each filter alone returns only matching cases', async () => {
    expect(await titles('?course=9501')).toEqual(['Case A', 'Case B', 'Case D'])
    expect(await titles('?campus=9402')).toEqual(['Case B', 'Case C', 'Case D'])
    expect(await titles('?outcome=9301')).toEqual(['Case A', 'Case D'])
    expect(await titles('?search=sepsis')).toEqual(['Case A', 'Case D'])
  })

  test("outcome matches the current version only, not an old version's mapping", async () => {
    expect(await titles('?outcome=9301')).not.toContain('Case C')
    expect(await titles('?outcome=9302')).toEqual(['Case B', 'Case C'])
  })

  test('search looks at the current version only', async () => {
    // C's old version mentions sepsis; its current version is about stroke.
    expect(await titles('?search=stroke')).toEqual(['Case C'])
    expect(await titles('?search=sepsis')).not.toContain('Case C')
  })

  test('filters combine with AND, and with search', async () => {
    expect(await titles('?course=9501&outcome=9302')).toEqual(['Case B'])
    expect(await titles('?campus=9402&outcome=9302')).toEqual(['Case B', 'Case C'])
    expect(await titles('?search=sepsis&campus=9401')).toEqual(['Case A', 'Case D'])
    expect(await titles('?search=sepsis&course=9501&campus=9402&outcome=9301')).toEqual(['Case D'])
    expect(await titles('?search=asthma&outcome=9301')).toEqual([])
  })

  test('course and campus together mean the same case_use row', async () => {
    // D runs TEST 202 at North and TEST 101 at South, but not TEST 202 at South.
    expect(await titles('?course=9502&campus=9402')).toEqual(['Case C'])
    expect(await titles('?course=9501&campus=9402')).toEqual(['Case B', 'Case D'])
  })

  test('a case used in several courses is listed once', async () => {
    const response = await request(app).get('/api/cases?campus=9402')
    const ids = (response.body as { id: number }[]).map((row) => row.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  test('% and _ in the search match literally', async () => {
    expect(await titles('?search=' + encodeURIComponent('100%'))).toEqual(['Case E 100% safe_mode'])
    expect(await titles('?search=' + encodeURIComponent('%'))).toEqual(['Case E 100% safe_mode'])
    expect(await titles('?search=' + encodeURIComponent('safe_mode'))).toEqual(['Case E 100% safe_mode'])
    expect(await titles('?search=' + encodeURIComponent('_'))).toEqual(['Case E 100% safe_mode'])
  })

  test.each([
    ['not a number', '?course=abc', ['course']],
    ['a decimal', '?campus=1.5', ['campus']],
    ['negative', '?outcome=-1', ['outcome']],
    ['zero', '?course=0', ['course']],
    ['empty', '?course=', ['course']],
    ['too big for INT', '?course=99999999999', ['course']],
    ['repeated', '?course=9501&course=9502', ['course']],
    ['unknown course', '?course=999999', ['course']],
    ['unknown campus and outcome', '?campus=999999&outcome=999999', ['campus', 'outcome']],
  ])('an invalid or unknown id (%s) is a 400, not a 500', async (_label, query, fields) => {
    const response = await request(app).get('/api/cases' + query)
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'invalid_request', fields })
  })

  test('lookup lists return id and display fields, sorted', async () => {
    const courses = await request(app).get('/api/courses')
    expect(courses.status).toBe(200)
    expect(courses.body).toEqual([
      { id: 9501, code: 'TEST 101', title: 'Synthetic Course 101' },
      { id: 9502, code: 'TEST 202', title: null },
    ])

    const campuses = await request(app).get('/api/campuses')
    expect(campuses.body).toEqual([
      { id: 9401, name: 'Synthetic Campus North' },
      { id: 9402, name: 'Synthetic Campus South' },
    ])

    const outcomes = await request(app).get('/api/outcomes')
    expect(outcomes.body.map((row: { id: number }) => row.id)).toEqual([9303, 9301, 9302])
    expect(outcomes.body[0]).toEqual({
      id: 9303, framework: 'Another Framework', code: null, description: 'Synthetic outcome without a code',
    })
  })

  test('NFR-1: list and filtered search return in under 10 seconds with 100 cases', async () => {
    await admin.query(`
      INSERT INTO sim_case (title) SELECT 'Synthetic load case ' || n FROM generate_series(1, 100) AS n;
      INSERT INTO case_version (case_id, version_number, content)
        SELECT id, 1, jsonb_build_object('topic', 'Synthetic load topic ' || id)
          FROM sim_case WHERE title LIKE 'Synthetic load case %';
      UPDATE sim_case c SET current_version_id = v.id
        FROM case_version v WHERE v.case_id = c.id AND c.title LIKE 'Synthetic load case %';
      INSERT INTO case_use (case_id, campus_id, course_id)
        SELECT id, 9401 + id % 2, 9501 + id % 2 FROM sim_case WHERE title LIKE 'Synthetic load case %';
      INSERT INTO case_version_outcome (case_version_id, outcome_id)
        SELECT current_version_id, 9301 + id % 2 FROM sim_case WHERE title LIKE 'Synthetic load case %';
    `)

    for (const query of ['', '?search=load&course=9502&campus=9402&outcome=9302']) {
      const started = performance.now()
      const response = await request(app).get('/api/cases' + query)
      const seconds = (performance.now() - started) / 1000
      expect(response.status).toBe(200)
      expect(response.body.length).toBeGreaterThan(0)
      expect(seconds).toBeLessThan(10)
    }
  })

  test('#48 reads the current version and preserves legacy content and history', async () => {
    const original = await admin.query('SELECT id, content FROM case_version WHERE case_id = 9103 ORDER BY version_number')
    const response = await request(app).get('/api/cases/9103')
    expect(response.status).toBe(200)
    expect(response.body.currentVersion.id).toBe(9204)
    expect(response.body.currentVersion.versionNumber).toBe(2)
    expect(response.body.currentVersion.content).toEqual({ topic: 'Synthetic stroke' })
    expect((await admin.query('SELECT id, content FROM case_version WHERE case_id = 9103 ORDER BY version_number')).rows)
      .toEqual(original.rows)
    const empty = await request(app).get('/api/cases/9105')
    expect(empty.status).toBe(200)
    expect(empty.body.currentVersion).toBeNull()
    expect((await request(app).get('/api/cases/2147483647')).status).toBe(404)
  })

  test('#44 saves selected role details and reads them back without losing blanks or ranges', async () => {
    const content = cleanContent({
      roles: {
        participants: [
          { role: 'Observers', detail: '6-10', selected: 'true' },
          { role: 'Recorder', detail: '', selected: 'true' },
          { role: 'Primary Active Participants', detail: 'Omit this', selected: 'false' },
        ],
        patientEmbedded: [{ role: 'Charge Nurse', detail: 'Synthetic faculty role' }],
        educatorsStaff: [{ role: 'Lead Facilitator', detail: 'Synthetic facilitator role' }],
      },
      patientChart: { historyOfPresentIllness: 'Synthetic first line\nSynthetic second line' },
    })
    const created = await request(app).post('/api/cases').send({ title: '[TEST] Synthetic role round trip', content })
    expect(created.status).toBe(201)
    const detail = await request(app).get('/api/cases/' + created.body.id)
    expect(detail.status).toBe(200)
    expect(detail.body.currentVersion.content).toEqual(content)
    expect(detail.body.currentVersion.content.roles.participants).toEqual([
      { role: 'Observers', detail: '6-10' }, { role: 'Recorder', detail: '' },
    ])
    const listed = await request(app).get('/api/cases?search=Synthetic%20role%20round%20trip')
    expect(listed.body.map((row: { id: number }) => row.id)).toContain(created.body.id)
  })

  test('#48 returns old role selections and additional saved keys unchanged', async () => {
    const content = { roles: { participants: ['Observers'], participantCounts: '6-10',
      patientEmbeddedOther: 'Synthetic legacy role note' }, retiredSection: { oldField: 'Synthetic old value' } }
    const created = await request(app).post('/api/cases').send({ title: '[TEST] Synthetic legacy round trip', content })
    expect(created.status).toBe(201)
    const detail = await request(app).get('/api/cases/' + created.body.id)
    expect(detail.status).toBe(200)
    expect(detail.body.currentVersion.content).toEqual(content)
  })
})
