// Plain helpers for the Cases page's search and filters. Kept out of CasesPage.tsx
// so that file exports only components and Vite's fast refresh keeps working.
import { FILTER_KEYS } from '../api/cases'
import type { CaseFilters, Course, Outcome } from '../api/cases'

export function casesReturnTo(value: string | null): string {
  return value === '/cases' || value?.startsWith('/cases?') ? value : '/cases'
}

// What the status line says once results arrive. "No cases yet" only when nothing
// is filtered, so an empty search doesn't suggest the database is empty.
export function describeResults(count: number, filtered: boolean): string {
  if (count === 0) return filtered ? 'No cases match these filters.' : 'No cases yet'
  const noun = count === 1 ? 'case' : 'cases'
  if (!filtered) return `${count} ${noun}`
  return `${count} ${noun} ${count === 1 ? 'matches' : 'match'}`
}

// Reads the filters from the page URL, ignoring any other parameters.
export function filtersFromParams(params: URLSearchParams): CaseFilters {
  const filters: CaseFilters = {}
  for (const key of FILTER_KEYS) {
    const value = params.get(key)?.trim()
    if (value) filters[key] = value
  }
  return filters
}

export function courseLabel(course: Course): string {
  return course.title ? `${course.code}: ${course.title}` : course.code
}

export function outcomeLabel(outcome: Outcome): string {
  return outcome.code ? `${outcome.code}: ${outcome.description}` : outcome.description
}
