import type { CaseLinks } from '../api/cases'
import type { CaseContent } from './caseTemplate'

// What the author has typed for where the case is used. Courses are one entry each,
// because a case can be used in several (for example NRS 424 and NRS 435).
export type LinkChoices = { campus: string; courses: string[] }

export const emptyLinkChoices: LinkChoices = { campus: '', courses: [] }

// "NRS  424 " and "NRS 424" are the same entry.
function tidy(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

function filled(entries: string[]): string[] {
  return entries.map(tidy).filter((entry) => entry !== '')
}

// The server stores a case's use as campus + course pairs, so one without the other
// cannot be saved. Say so before sending. Same rule as POST /api/cases.
export function linksProblem(choices: LinkChoices): string {
  const hasCampus = tidy(choices.campus) !== ''
  const hasCourse = filled(choices.courses).length > 0
  if (hasCampus && !hasCourse) return 'Add at least one course for the campus, or clear the campus.'
  if (!hasCampus && hasCourse) return 'Enter a campus for the courses.'
  return ''
}

// The outcomes are the ones already typed in "Learning outcomes and objectives", so
// nobody enters them twice.
export function outcomesFromContent(content: CaseContent): string[] {
  const typed = content.learningOutcomes?.outcomes
  return Array.isArray(typed) ? filled(typed.filter((item): item is string => typeof item === 'string')) : []
}

// The request fields the API expects, outside `content`.
export function toCaseLinks(choices: LinkChoices, content: CaseContent): CaseLinks {
  const links: CaseLinks = { courses: filled(choices.courses), outcomes: outcomesFromContent(content) }
  const campus = tidy(choices.campus)
  if (campus !== '') links.campus = campus
  return links
}

// The campus and courses are also saved as text in General information, so the case
// details page keeps showing them. The links are what the filters use; this is a copy.
export function displayCopy(choices: LinkChoices): { campus?: string; course?: string } {
  const copy: { campus?: string; course?: string } = {}
  const campus = tidy(choices.campus)
  if (campus !== '') copy.campus = campus
  const courses = filled(choices.courses)
  if (courses.length > 0) copy.course = courses.join(', ')
  return copy
}