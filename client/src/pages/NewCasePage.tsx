import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createCase } from '../api/cases'
import FieldInput from '../components/FieldInput'
import { caseTemplate } from '../templates/caseTemplate'
import type { CaseContent, Field, FieldValue } from '../templates/caseTemplate'
import { cleanContent } from '../templates/cleanContent'
import './NewCasePage.css'

export default function NewCasePage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<CaseContent>({})
  const [titleError, setTitleError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  function setValue(sectionKey: string, fieldKey: string, value: FieldValue) {
    setContent((previous) => ({
      ...previous,
      [sectionKey]: { ...previous[sectionKey], [fieldKey]: value },
    }))
  }

  function renderFields(sectionKey: string, fields: Field[]) {
    const values = content[sectionKey] ?? {}
    return fields.map((field) => {
      const otherRaw = values[field.key + 'Other']
      const otherValue = typeof otherRaw === 'string' ? otherRaw : ''
      return (
        <FieldInput
          key={field.key}
          sectionKey={sectionKey}
          field={field}
          value={values[field.key]}
          otherValue={otherValue}
          onChange={(fieldKey, value) => setValue(sectionKey, fieldKey, value)}
        />
      )
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccessMessage('')
    setErrorMessage('')

    if (title.trim() === '') {
      setTitleError('Title is required.')
      titleRef.current?.focus()
      return
    }
    setTitleError('')

    setSaving(true)
    try {
      await createCase(title.trim(), cleanContent(content))
      setSuccessMessage('Case saved as a draft.')
      setTitle('')
      setContent({})
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the case.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="case-form" onSubmit={handleSubmit} noValidate>
      <h1>New case</h1>
      <p>Use fictional data only. Never enter real patient, learner, or staff information.</p>

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

      {caseTemplate.map((section) =>
        section.optional ? (
          <details key={section.key}>
            <summary>{section.title}</summary>
            {renderFields(section.key, section.fields)}
          </details>
        ) : (
          <section key={section.key}>
            <h2>{section.title}</h2>
            {renderFields(section.key, section.fields)}
          </section>
        ),
      )}

      <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save case'}</button>
      {successMessage && <p role="status">{successMessage}</p>}
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
    </form>
  )
}
