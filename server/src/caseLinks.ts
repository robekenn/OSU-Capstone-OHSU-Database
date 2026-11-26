import type { PoolClient } from 'pg'

// Outcomes typed into a case have no framework of their own, so they are filed under this one.
// The Cases page groups its Outcome dropdown by framework.
export const CASE_OUTCOME_FRAMEWORK = 'Case outcomes'

// Held for the whole transaction while links are saved. The lookup tables have no unique
// constraint, so without it two cases saved at the same moment could each create "Portland".
const LOOKUP_LOCK = 7701

// What a case says about where it is used and what it teaches, as typed by the author.
export type CaseLinkNames = { campus?: string; courses: string[]; outcomes: string[] }

// "NRS  424 " and "NRS 424" are the same entry.
export function tidy(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

// Tidies every entry, drops blanks, and keeps each entry once, ignoring upper/lower case.
// The first spelling wins.
export function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const name of names) {
    const clean = tidy(name)
    if (clean === '' || seen.has(clean.toLowerCase())) continue
    seen.add(clean.toLowerCase())
    kept.push(clean)
  }
  return kept
}

async function findOrCreateCampus(client: PoolClient, name: string): Promise<number> {
  const found = await client.query<{ id: number }>(
    'SELECT id FROM campus WHERE lower(btrim(name)) = lower($1) ORDER BY id LIMIT 1', [name],
  )
  if (found.rows[0]) return found.rows[0].id
  const created = await client.query<{ id: number }>('INSERT INTO campus (name) VALUES ($1) RETURNING id', [name])
  return created.rows[0].id
}

async function findOrCreateCourse(client: PoolClient, code: string): Promise<number> {
  const found = await client.query<{ id: number }>(
    'SELECT id FROM course WHERE lower(btrim(code)) = lower($1) ORDER BY id LIMIT 1', [code],
  )
  if (found.rows[0]) return found.rows[0].id
  const created = await client.query<{ id: number }>('INSERT INTO course (code) VALUES ($1) RETURNING id', [code])
  return created.rows[0].id
}

async function findOrCreateOutcome(client: PoolClient, description: string): Promise<number> {
  const found = await client.query<{ id: number }>(
    `SELECT id FROM outcome WHERE framework = $1 AND lower(btrim(description)) = lower($2) ORDER BY id LIMIT 1`,
    [CASE_OUTCOME_FRAMEWORK, description],
  )
  if (found.rows[0]) return found.rows[0].id
  const created = await client.query<{ id: number }>(
    'INSERT INTO outcome (framework, outcome_type, description) VALUES ($1, $2, $3) RETURNING id',
    [CASE_OUTCOME_FRAMEWORK, 'competency', description],
  )
  return created.rows[0].id
}

// Records where a case is used (case_use) and which outcomes this version supports
// (case_version_outcome), creating any campus, course or outcome that is not in its
// table yet. Call it inside the transaction that creates the case.
export async function saveCaseLinks(client: PoolClient, caseId: number, versionId: number, links: CaseLinkNames) {
  const campus = links.campus === undefined ? '' : tidy(links.campus)
  const courses = uniqueNames(links.courses)
  const outcomes = uniqueNames(links.outcomes)
  if (campus === '' && courses.length === 0 && outcomes.length === 0) return

  await client.query('SELECT pg_advisory_xact_lock($1)', [LOOKUP_LOCK])

  if (campus !== '') {
    const campusId = await findOrCreateCampus(client, campus)
    for (const course of courses) {
      const courseId = await findOrCreateCourse(client, course)
      // ON CONFLICT: two spellings can resolve to the same course row.
      await client.query(
        'INSERT INTO case_use (case_id, campus_id, course_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [caseId, campusId, courseId],
      )
    }
  }

  for (const outcome of outcomes) {
    const outcomeId = await findOrCreateOutcome(client, outcome)
    await client.query(
      'INSERT INTO case_version_outcome (case_version_id, outcome_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [versionId, outcomeId],
    )
  }
}