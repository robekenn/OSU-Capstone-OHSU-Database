import type { CaseContent } from '../templates/caseTemplate'

export type CaseSummary = {
  id: number
  title: string
  status: string | null
  updatedAt: string | null
}

export type CaseDetail = {
  id: number
  title: string
  currentVersion: {
    id: number
    versionNumber: number
    status: string
    createdAt: string
    content: unknown
  } | null
}

export async function getCase(caseId: string, signal?: AbortSignal): Promise<CaseDetail> {
  const response = await fetch('/api/cases/' + encodeURIComponent(caseId), { signal })
  if (response.status === 404) throw new Error('Case not found.')
  if (response.status === 401) throw new Error('Sign in to read this case.')
  if (response.status === 403) throw new Error('You do not have permission to read this case.')
  if (!response.ok) throw new Error('Could not load the case (status ' + response.status + ').')
  const data: unknown = await response.json()
  if (data && typeof data === 'object') {
    const item = data as Record<string, unknown>
    const version = item.currentVersion
    if (typeof item.id === 'number' && typeof item.title === 'string'
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

export async function listCases(filters: CaseFilters = {}, signal?: AbortSignal): Promise<CaseSummary[]> {
  const response = await fetch('/api/cases' + filtersToQuery(filters), { signal })
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
  const response = await fetch(path, { signal })
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

export async function createCase(title: string, content: CaseContent): Promise<{ id: number; versionId: number }> {
  const response = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
  if (!response.ok) {
    throw new Error('Could not save the case (status ' + response.status + ').')
  }
  return response.json()
}
