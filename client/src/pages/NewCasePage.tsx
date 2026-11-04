import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createCase } from '../api/cases'
import FieldInput from '../components/FieldInput'
import { caseTemplate } from '../templates/caseTemplate'
import type { CaseContent, Field, FieldValue, TableRow } from '../templates/caseTemplate'
import './NewCasePage.css'

// Removes blank answers before saving, so the saved case has no empty clutter.
function cleanContent(raw: CaseContent): CaseContent {
  const cleaned: CaseContent = {}
  for (const section of caseTemplate) {
    const values = raw[section.key]
    if (!values) continue

    const cleanValues: Record<string, FieldValue> = {}
    for (const fieldKey of Object.keys(values)) {
      const value = values[fieldKey]
      if (typeof value === 'string') {
        if (value.trim() !== '') cleanValues[fieldKey] = value
        continue
      }
      const strings: string[] = []
      const rows: TableRow[] = []
      for (const item of value) {
        if (typeof item === 'string') {
          if (item.trim() !== '') strings.push(item)
        } else if (Object.values(item).some((cell) => cell.trim() !== '')) {
          rows.push(item)
        }
      }
      if (strings.length > 0) cleanValues[fieldKey] = strings
      if (rows.length > 0) cleanValues[fieldKey] = rows
    }
    if (Object.keys(cleanValues).length > 0) cleaned[section.key] = cleanValues
  }
  return cleaned
}

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