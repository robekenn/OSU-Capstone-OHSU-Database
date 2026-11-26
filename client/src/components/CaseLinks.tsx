import type { Lookups } from '../pages/CasesPage'
import type { LinkChoices } from '../templates/caseLinks'

type Props = {
  // Campuses and courses other cases already use, offered as suggestions while typing.
  suggestions: Lookups
  choices: LinkChoices
  error: string
  onChange: (next: LinkChoices) => void
}

// Where the case is used. The author types a campus and one entry per course; saving the
// case adds any that are new, and the Cases page filters then list them.
export default function CaseLinks({ suggestions, choices, error, onChange }: Props) {
  const campusNames = suggestions.kind === 'ready' ? suggestions.campuses.map((campus) => campus.name) : []
  const courseCodes = suggestions.kind === 'ready' ? suggestions.courses.map((course) => course.code) : []

  return (
    <div>
      <div className="field">
        <label htmlFor="case-campus">Campus</label>
        <input
          id="case-campus"
          type="text"
          list="case-campus-options"
          value={choices.campus}
          aria-invalid={error !== ''}
          aria-describedby={error ? 'case-links-error' : undefined}
          onChange={(event) => onChange({ ...choices, campus: event.target.value })}
        />
        <datalist id="case-campus-options">
          {campusNames.map((name) => <option key={name} value={name} />)}
        </datalist>
      </div>

      <fieldset className="field">
        <legend>Courses</legend>
        <p className="help">
          Add each course this case is used in, for example NRS 424. Pick a suggestion or type a new one.
          The Outcomes you list in Learning outcomes and objectives also become filter options.
        </p>
        {choices.courses.map((course, index) => (
          <div key={index} className="row">
            <label htmlFor={'case-course-' + index}>{'Course ' + (index + 1)}</label>
            <input
              id={'case-course-' + index}
              type="text"
              list="case-course-options"
              value={course}
              onChange={(event) => {
                const next = [...choices.courses]
                next[index] = event.target.value
                onChange({ ...choices, courses: next })
              }}
            />
            <button
              type="button"
              onClick={() => onChange({ ...choices, courses: choices.courses.filter((_course, i) => i !== index) })}
            >
              Remove course {index + 1}
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...choices, courses: [...choices.courses, ''] })}>
          Add course
        </button>
        <datalist id="case-course-options">
          {courseCodes.map((code) => <option key={code} value={code} />)}
        </datalist>
      </fieldset>

      {error && <p id="case-links-error" className="error" role="alert">{error}</p>}
    </div>
  )
}