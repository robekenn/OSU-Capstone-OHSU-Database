import type { CaseContent } from '../templates/caseTemplate'
import type { DraftChanges } from '../templates/editContent'
import { appFetch } from './http'

export type CaseSummary = {
  id: number
  title: string
  status: string | null
  updatedAt: string | null
}

export type CaseDetail = {
  id: number
  title: string
  archived: boolean
  currentVersion: {
    id: number
    versionNumber: number
    status: string
    createdAt: string
    content: unknown
  } | null
}

export async function getCase(caseId: string, signal?: AbortSignal): Promise<CaseDetail> {
  const response = await appFetch('/api/cases/' + encodeURIComponent(caseId), { signal })
  if (response.status === 404) throw new Error('Case not found.')
  if (response.status === 401) throw new Error('Sign in to read this case.')
  if (response.status === 403) throw new Error('You do not have permission to read this case.')
  if (!response.ok) throw new Error('Could not load the case (status ' + response.status + ').')
  const data: unknown = await response.json()
  if (data && typeof data === 'object') {
    const item = data as Record<string, unknown>
    const version = item.currentVersion
    if (typeof item.id === 'number' && typeof item.title === 'string' && typeof item.archived === 'boolean'
      && (version === null || (version && typeof version === 'object'
        && typeof (version as Record<string, unknown>).id === 'number'
        && typeof (version as Record<string, unknown>).versionNumber === 'number'
        && typeof (version as Record<string, unknown>).status === 'string'
        && typeof (version as Record<string, unknown>).createdAt === 'string'
        && 'content' in version))) return data as CaseDetail
  }
  throw new Error('The server returned an unexpected case detail.')
}

// The search and filter values, exactly as they appear in the page URL and the API.
// A missing key means "Any".
export const FILTER_KEYS = ['search', 'course', 'campus', 'outcome'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type CaseFilters = Partial<Record<FilterKey, string>>

// Builds "?search=...&course=..." with only the filters that are set,
// or "" when none are, so the plain list is still just /api/cases.
export function filtersToQuery(filters: CaseFilters): string {
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim()
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? '?' + query : ''
}

// The server rejected a filter value, so refreshing won't help; clearing will.
export class InvalidFilterError extends Error {}

export async function listCases(filters: CaseFilters = {}, signal?: AbortSignal, archived = false): Promise<CaseSummary[]> {
  const params = new URLSearchParams(filtersToQuery(filters))
  if (archived) params.set('archived', '1')
  const response = await appFetch('/api/cases' + (params.size ? '?' + params : ''), { signal })
  if (response.status === 400) {
    // Usually a bookmarked filter whose course, campus or outcome no longer exists.
    const body: unknown = await response.json().catch(() => null)
    const fields = body && typeof body === 'object' && Array.isArray((body as { fields?: unknown }).fields)
      ? ((body as { fields: unknown[] }).fields).map(String).filter((field) => (FILTER_KEYS as readonly string[]).includes(field))
      : []
    const which = fields.length > 0 ? ' (' + fields.join(', ') + ')' : ''
    throw new InvalidFilterError('A filter in this address is not valid' + which + '. Use Clear filters to start over.')
  }
  if (!response.ok) {
    throw new Error('Could not load cases (status ' + response.status + ').')
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false
    const row = item as Record<string, unknown>
    return typeof row.id === 'number' && typeof row.title === 'string'
      && (row.status === null || typeof row.status === 'string')
      && (row.updatedAt === null || typeof row.updatedAt === 'string')
  })) {
    throw new Error('The server returned an unexpected case list.')
  }
  return data as CaseSummary[]
}

export type Course = { id: number; code: string; title: string | null }
export type Campus = { id: number; name: string }
export type Outcome = { id: number; framework: string; code: string | null; description: string }

const isString = (value: unknown) => typeof value === 'string'
const isNullableString = (value: unknown) => value === null || typeof value === 'string'

// Fetches one of the lookup lists and checks every row has the expected fields.
async function fetchList<T>(path: string, fields: Record<string, (value: unknown) => boolean>, signal?: AbortSignal): Promise<T[]> {
  const response = await appFetch(path, { signal })
  if (!response.ok) {
    throw new Error('Could not load filter options (status ' + response.status + ').')
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false
    const row = item as Record<string, unknown>
    return typeof row.id === 'number' && Object.entries(fields).every(([key, check]) => check(row[key]))
  })) {
    throw new Error('The server returned unexpected filter options.')
  }
  return data as T[]
}

export const listCourses = (signal?: AbortSignal) =>
  fetchList<Course>('/api/courses', { code: isString, title: isNullableString }, signal)

export const listCampuses = (signal?: AbortSignal) =>
  fetchList<Campus>('/api/campuses', { name: isString }, signal)

export const listOutcomes = (signal?: AbortSignal) =>
  fetchList<Outcome>('/api/outcomes', { framework: isString, code: isNullableString, description: isString }, signal)

// Where a case is used and what it teaches, as typed. These go beside `content`, not inside
// it: the server saves them in their own tables, creating any campus, course or outcome that
// is new, so the Cases page filters can offer them.
export type CaseLinks = { campus?: string; courses: string[]; outcomes: string[] }

export async function createCase(
  title: string,
  content: CaseContent,
  links: CaseLinks = { courses: [], outcomes: [] },
): Promise<{ id: number; versionId: number }> {
  const response = await appFetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, ...links }),
  })
  if (response.status === 400) {
    // The server checks the links too. Say what is wrong instead of a bare status.
    const body: { fields?: unknown } | null = await response.json().catch(() => null)
    if (body && Array.isArray(body.fields) && body.fields.some((field) => ['campus', 'courses', 'outcomes'].includes(String(field)))) {
      throw new Error('A campus needs at least one course, and a course needs a campus. Check them and try again.')
    }
  }
  if (!response.ok) {
    throw new Error('Could not save the case (status ' + response.status + ').')
  }
  return response.json()
}

export async function saveCaseVersion(caseId: string, expectedVersionId: number, title: string, changes: DraftChanges) {
  const response = await appFetch('/api/cases/' + encodeURIComponent(caseId) + '/versions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersionId, title, changes }),
  })
  if (response.status === 409) {
    const body: { error?: string } | null = await response.json().catch(() => null)
    if (body?.error === 'stale_version') {
      throw new Error('Someone saved a newer version. Your changes are still here. Open the case in another tab to compare.')
    }
    throw new Error('This case can no longer be edited. Your changes are still here.')
  }
  if (!response.ok) throw new Error('Could not save the new version (status ' + response.status + ').')
}

export async function setCaseArchived(caseId: string, archived: boolean) {
  const response = await appFetch('/api/cases/' + encodeURIComponent(caseId) + '/archive', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }),
  })
  if (response.status === 409) throw new Error('Only a case with a current draft can be archived.')
  if (!response.ok) throw new Error(`Could not ${archived ? 'archive' : 'restore'} the case (status ${response.status}).`)
}