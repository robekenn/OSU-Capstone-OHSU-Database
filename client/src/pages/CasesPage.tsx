import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { InvalidFilterError, filtersToQuery, listCampuses, listCases, listCourses, listOutcomes } from '../api/cases'
import type { Campus, CaseFilters, CaseSummary, Course, Outcome } from '../api/cases'
import { courseLabel, describeResults, filtersFromParams, outcomeLabel } from './caseFilters'

export function CasesTable({ cases, returnTo = '/cases' }: { cases: CaseSummary[]; returnTo?: string }) {
  // The page's status line says when there are no cases, so an empty list renders nothing here.
  if (cases.length === 0) return null

  return (
    <div className="cases-table-wrap">
      <table className="cases-table">
        <caption>Simulation cases</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => {
            const date = item.updatedAt ? new Date(item.updatedAt) : null
            return (
              <tr key={item.id}>
                <td><a href={'/cases/' + item.id + '?returnTo=' + encodeURIComponent(returnTo)}>{item.title}</a></td>
                <td>{item.status || 'Not available'}</td>
                <td>{date && !Number.isNaN(date.getTime()) ? (
                  <time dateTime={item.updatedAt ?? undefined}>{date.toLocaleString()}</time>
                ) : 'Not available'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export type Lookups =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; courses: Course[]; campuses: Campus[]; outcomes: Outcome[] }

type FilterFormProps = {
  draft: CaseFilters
  lookups: Lookups
  onChange: (key: keyof CaseFilters, value: string) => void
  onSubmit: () => void
  onClear: () => void
}

// The search box and dropdowns. Nothing applies until Search is pressed (or Enter
// in the text box), so arrowing through a dropdown with the keyboard doesn't
// reload the list or add a Back-button entry for every option it passes.
export function FilterForm({ draft, lookups, onChange, onSubmit, onClear }: FilterFormProps) {
  const ready = lookups.kind === 'ready'
  const outcomesByFramework = new Map<string, Outcome[]>()
  if (ready) {
    for (const outcome of lookups.outcomes) {
      const group = outcomesByFramework.get(outcome.framework) ?? []
      group.push(outcome)
      outcomesByFramework.set(outcome.framework, group)
    }
  }

  return (
    <form
      className="case-filters"
      role="search"
      aria-label="Search and filter cases"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="case-filters-field case-filters-search">
        <label htmlFor="case-search">Search</label>
        <input
          id="case-search"
          type="search"
          maxLength={200}
          value={draft.search ?? ''}
          onChange={(event) => onChange('search', event.target.value)}
        />
      </div>

      <div className="case-filters-field">
        <label htmlFor="case-course">Course</label>
        <select id="case-course" disabled={!ready} value={draft.course ?? ''}
          onChange={(event) => onChange('course', event.target.value)}>
          <option value="">Any course</option>
          {ready && lookups.courses.map((course) => (
            <option key={course.id} value={String(course.id)}>{courseLabel(course)}</option>
          ))}
        </select>
      </div>

      <div className="case-filters-field">
        <label htmlFor="case-campus">Campus</label>
        <select id="case-campus" disabled={!ready} value={draft.campus ?? ''}
          onChange={(event) => onChange('campus', event.target.value)}>
          <option value="">Any campus</option>
          {ready && lookups.campuses.map((campus) => (
            <option key={campus.id} value={String(campus.id)}>{campus.name}</option>
          ))}
        </select>
      </div>

      <div className="case-filters-field">
        <label htmlFor="case-outcome">Outcome</label>
        <select id="case-outcome" disabled={!ready} value={draft.outcome ?? ''}
          onChange={(event) => onChange('outcome', event.target.value)}>
          <option value="">Any outcome</option>
          {[...outcomesByFramework].map(([framework, outcomes]) => (
            <optgroup key={framework} label={framework}>
              {outcomes.map((outcome) => (
                <option key={outcome.id} value={String(outcome.id)}>{outcomeLabel(outcome)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="case-filters-actions">
        <button type="submit">Search</button>
        <button type="button" onClick={onClear}>Clear filters</button>
      </div>

      {lookups.kind === 'error' && (
        <p role="alert" className="case-filters-note">
          Could not load the course, campus and outcome lists. Text search still works.
        </p>
      )}
    </form>
  )
}

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; key: string; message: string; badFilter: boolean }
  | { kind: 'ready'; key: string; cases: CaseSummary[] }

export default function CasesPage() {
  // The URL is the source of truth for the applied filters, so a search can be
  // bookmarked and Back/Forward step through earlier searches.
  const [searchParams, setSearchParams] = useSearchParams()
  const applied = filtersFromParams(searchParams)
  const appliedQuery = filtersToQuery(applied)
  const filtered = appliedQuery !== ''

  // What's typed or picked but not applied yet. Reset whenever the URL changes
  // (Back, Forward, Clear), so the form always shows the filters in effect.
  const [draft, setDraft] = React.useState<CaseFilters>(applied)
  const [draftFor, setDraftFor] = React.useState(appliedQuery)
  if (draftFor !== appliedQuery) {
    setDraftFor(appliedQuery)
    setDraft(applied)
  }

  const [reload, setReload] = React.useState(0)
  const requestKey = appliedQuery + '#' + reload
  const [state, setState] = React.useState<ListState>({ kind: 'loading' })
  // A result for an older request counts as still loading.
  const view: ListState = state.kind !== 'loading' && state.key === requestKey ? state : { kind: 'loading' }

  React.useEffect(() => {
    const controller = new AbortController()
    listCases(filtersFromParams(new URLSearchParams(appliedQuery)), controller.signal).then(
      (cases) => { if (!controller.signal.aborted) setState({ kind: 'ready', key: requestKey, cases }) },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            kind: 'error',
            key: requestKey,
            message: error instanceof Error ? error.message : 'Could not load cases.',
            badFilter: error instanceof InvalidFilterError,
          })
        }
      },
    )
    return () => controller.abort()
  }, [appliedQuery, requestKey])

  const [lookups, setLookups] = React.useState<Lookups>({ kind: 'loading' })
  React.useEffect(() => {
    const controller = new AbortController()
    Promise.all([listCourses(controller.signal), listCampuses(controller.signal), listOutcomes(controller.signal)]).then(
      ([courses, campuses, outcomes]) => {
        if (!controller.signal.aborted) setLookups({ kind: 'ready', courses, campuses, outcomes })
      },
      () => { if (!controller.signal.aborted) setLookups({ kind: 'error' }) },
    )
    return () => controller.abort()
  }, [])

  function apply(next: CaseFilters) {
    const query = filtersToQuery(next)
    if (query === appliedQuery) {
      // Same search again: refetch instead of adding a duplicate history entry.
      setReload((value) => value + 1)
    } else {
      setSearchParams(new URLSearchParams(query))
    }
  }

  let statusText = ''
  if (view.kind === 'loading') statusText = 'Loading cases...'
  if (view.kind === 'ready') statusText = describeResults(view.cases.length, filtered)

  return (
    <section className="cases-page">
      <h1>Cases</h1>

      <FilterForm
        draft={draft}
        lookups={lookups}
        onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
        onSubmit={() => apply(draft)}
        onClear={() => {
          setDraft({})
          if (filtered) setSearchParams(new URLSearchParams())
        }}
      />

      <div className="cases-results-bar">
        {/* Always in the page, so screen readers announce each new count or "No cases match". */}
        <p role="status" className="cases-status">{statusText}</p>
        <button type="button" disabled={view.kind === 'loading'} onClick={() => setReload((value) => value + 1)}>
          Refresh cases
        </button>
      </div>

      {view.kind === 'error' && (
        <p role="alert">{view.message}{view.badFilter ? '' : ' Use Refresh cases to try again.'}</p>
      )}
      {view.kind === 'ready' && <CasesTable cases={view.cases} returnTo={'/cases' + (searchParams.size ? '?' + searchParams.toString() : '')} />}
    </section>
  )
}
