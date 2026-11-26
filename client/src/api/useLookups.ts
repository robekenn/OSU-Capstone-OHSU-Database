import { useEffect, useState } from 'react'
import type { Lookups } from '../pages/CasesPage'
import { listCampuses, listCourses, listOutcomes } from './cases'

// Loads the campus, course and outcome lists once, for forms that need to offer them.
// It starts as "loading" and ends as "ready" or "error", like the Cases page filters.
export function useLookups(): Lookups {
  const [lookups, setLookups] = useState<Lookups>({ kind: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([listCourses(controller.signal), listCampuses(controller.signal), listOutcomes(controller.signal)]).then(
      ([courses, campuses, outcomes]) => {
        if (!controller.signal.aborted) setLookups({ kind: 'ready', courses, campuses, outcomes })
      },
      () => { if (!controller.signal.aborted) setLookups({ kind: 'error' }) },
    )
    return () => controller.abort()
  }, [])
  return lookups
}