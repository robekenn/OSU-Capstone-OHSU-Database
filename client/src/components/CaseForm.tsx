import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import CaseLinks from './CaseLinks'
import SectionForm from './SectionForm'
import { formSections, titleProblem } from '../templates/caseSections'
import type { CaseContent, FieldValue } from '../templates/caseTemplate'
import { emptyLinkChoices, linksProblem } from '../templates/caseLinks'
import type { LinkChoices } from '../templates/caseLinks'
import type { Lookups } from '../pages/CasesPage'
import '../pages/NewCasePage.css'

type Props = {
  initialTitle?: string
  initialContent?: CaseContent
  readOnlyFields?: ReadonlySet<string>
  cancelTo?: string
  // Pass the campuses and courses other cases use to show the Campus and Courses inputs
  // (New case only). Without it the form keeps the plain Campus and Course text fields.
  suggestions?: Lookups
  onSave: (title: string, content: CaseContent, touched: CaseContent, choices: LinkChoices) => Promise<void>
}

// The Campus and Courses inputs replace these two text fields when they are on screen.
const fieldsReplacedByLinks: ReadonlySet<string> = new Set(['generalInformation.campus', 'generalInformation.course'])

export default function CaseForm({ initialTitle = '', initialContent = {}, readOnlyFields, cancelTo, suggestions, onSave }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState<CaseContent>(initialContent)
  const [touched, setTouched] = useState<CaseContent>({})
  const [choices, setChoices] = useState<LinkChoices>(emptyLinkChoices)
  const [linksError, setLinksError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [titleError, setTitleError] = useState('')
  const [focusRequest, setFocusRequest] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const editing = cancelTo !== undefined
  const activeSection = formSections[activeIndex]
  const hiddenFields = suggestions ? fieldsReplacedByLinks : undefined
  const isFirst = activeIndex === 0
  const isLast = activeIndex === formSections.length - 1

  // After a failed Create we jump back to General information. The title box only
  // exists once that section is on screen, so we focus it here, after the render.
  useEffect(() => {
    if (focusRequest > 0) {
      titleRef.current?.focus()
    }
  }, [focusRequest])

  function setValue(templateKey: string, fieldKey: string, value: FieldValue) {
    setContent((previous) => ({
      ...previous,
      [templateKey]: { ...previous[templateKey], [fieldKey]: value },
    }))
    if (editing) setTouched((previous) => ({
      ...previous,
      [templateKey]: { ...previous[templateKey], [fieldKey]: value },
    }))
  }

  // Pressing Enter in a text box must not Create the case early.
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement
    if (event.key === 'Enter' && target.tagName === 'INPUT') {
      event.preventDefault()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSuccessMessage('')
    setErrorMessage('')

    const problem = titleProblem(title)
    if (problem !== '') {
      setTitleError(problem)
      setActiveIndex(0)
      setFocusRequest(focusRequest + 1)
      return
    }
    setTitleError('')

    if (suggestions) {
      const linksIssue = linksProblem(choices)
      if (linksIssue !== '') {
        setLinksError(linksIssue)
        setActiveIndex(0)
        return
      }
    }
    setLinksError('')

    setSaving(true)
    try {
      await onSave(title.trim(), content, touched, choices)
      if (editing) return
      setSuccessMessage('Case saved as a draft.')
      setTitle('')
      setContent({})
      setChoices(emptyLinkChoices)
      setActiveIndex(0)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the case.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="case-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <h1>{editing ? 'Edit draft' : 'New case'}</h1>
      {editing
        ? <p>Saving creates a new version and keeps the previous one.</p>
        : <p>Fill in any sections you like, in any order. Only the title is required. Nothing is
            saved until you press Create case.</p>}
      <div inert={saving}>
        <nav aria-label="Case sections">
          <ol className="section-nav">
            {formSections.map((section, index) => (
              <li key={section.key}>
                <button
                  type="button"
                  aria-current={index === activeIndex ? 'step' : undefined}
                  onClick={() => setActiveIndex(index)}
                >
                  {index + 1}. {section.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {isFirst && (
          <div className="field">
            <label htmlFor="case-title">Title (required)</label>
            <input
              id="case-title"
              ref={titleRef}
              type="text"
              value={title}
              aria-invalid={titleError !== ''}
              aria-describedby={titleError ? 'case-title-error' : undefined}
              onChange={(event) => setTitle(event.target.value)}
            />
            {titleError && (
              <p id="case-title-error" className="error" role="alert">{titleError}</p>
            )}
          </div>
        )}

        {isFirst && suggestions && (
          <CaseLinks suggestions={suggestions} choices={choices} error={linksError} onChange={setChoices} />
        )}

        <SectionForm
          formSection={activeSection}
          content={content}
          readOnlyFields={readOnlyFields}
          hiddenFields={hiddenFields}
          onChange={setValue}
        />

        <div className="section-buttons">
          <button type="button" disabled={isFirst} onClick={() => setActiveIndex(activeIndex - 1)}>
            Previous section
          </button>
          <button type="button" disabled={isLast} onClick={() => setActiveIndex(activeIndex + 1)}>
            Next section
          </button>
        </div>

      </div>

      <div className="section-buttons">
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save new version' : 'Create case'}</button>
        {cancelTo && !saving && <Link to={cancelTo}>Cancel</Link>}
      </div>
      {successMessage && <p role="status">{successMessage}</p>}
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
    </form>
  )
}