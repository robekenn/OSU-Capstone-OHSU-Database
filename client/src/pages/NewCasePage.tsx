import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createCase } from '../api/cases'
import SectionForm from '../components/SectionForm'
import { formSections, titleProblem } from '../templates/caseSections'
import type { CaseContent, FieldValue } from '../templates/caseTemplate'
import { cleanContent } from '../templates/cleanContent'
import './NewCasePage.css'

export default function NewCasePage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<CaseContent>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [titleError, setTitleError] = useState('')
  const [focusRequest, setFocusRequest] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const activeSection = formSections[activeIndex]
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

    setSaving(true)
    try {
      await createCase(title.trim(), cleanContent(content))
      setSuccessMessage('Case saved as a draft.')
      setTitle('')
      setContent({})
      setActiveIndex(0)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the case.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="case-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <h1>New case</h1>
      <p>
        Fill in any sections you like, in any order. Only the title is required. Nothing is
        saved until you press Create case.
      </p>

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

      <SectionForm formSection={activeSection} content={content} onChange={setValue} />

      <div className="section-buttons">
        <button type="button" disabled={isFirst} onClick={() => setActiveIndex(activeIndex - 1)}>
          Previous section
        </button>
        <button type="button" disabled={isLast} onClick={() => setActiveIndex(activeIndex + 1)}>
          Next section
        </button>
      </div>

      <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create case'}</button>
      {successMessage && <p role="status">{successMessage}</p>}
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
    </form>
  )
}