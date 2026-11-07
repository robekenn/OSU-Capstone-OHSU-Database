import React from 'react'
import { caseTemplate } from '../templates/caseTemplate'
import type { Field } from '../templates/caseTemplate'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.some(hasValue)
  if (isRecord(value)) return Object.values(value).some(hasValue)
  return true
}

// Legacy values and unknown keys remain readable instead of being discarded.
function SavedValue({ value }: { value: unknown }) {
  if (!hasValue(value)) return <p>Not filled in</p>
  if (Array.isArray(value)) return <ul>{value.map((item, index) => <li key={index}><SavedValue value={item} /></li>)}</ul>
  if (isRecord(value)) return <dl>{Object.entries(value).map(([key, item]) => (
    <React.Fragment key={key}><dt>{key}</dt><dd><SavedValue value={item} /></dd></React.Fragment>
  ))}</dl>
  return <p className="saved-text">{String(value)}</p>
}

function SavedField({ field, value }: { field: Field; value: unknown }) {
  if (field.kind === 'roles' && Array.isArray(value) && value.every((row) => isRecord(row) && typeof row.role === 'string')) {
    return <dl>{value.map((row, index) => <React.Fragment key={index}>
      <dt>{row.role}</dt><dd><SavedValue value={row.detail} />
        {Object.entries(row).filter(([key]) => key !== 'role' && key !== 'detail').map(([key, extra]) => (
          <div key={key}><strong>{key}</strong><SavedValue value={extra} /></div>
        ))}
      </dd>
    </React.Fragment>)}</dl>
  }
  if (field.kind === 'table' && Array.isArray(value) && value.every(isRecord) && value.length > 0) {
    const keys = [...new Set([...field.columns.map((column) => column.key), ...value.flatMap(Object.keys)])]
    return <div className="table-wrap"><table>
      <caption>{field.label}</caption>
      <thead><tr>{keys.map((key) => <th key={key} scope="col">{field.columns.find((column) => column.key === key)?.label ?? key}</th>)}</tr></thead>
      <tbody>{value.map((row, index) => <tr key={index}>{keys.map((key) => <td key={key}><SavedValue value={row[key]} /></td>)}</tr>)}</tbody>
    </table></div>
  }
  return <SavedValue value={value} />
}

export function CaseContentView({ content }: { content: unknown }) {
  if (!hasValue(content)) return <p>No saved content in this version.</p>
  if (!isRecord(content)) return <SavedValue value={content} />

  return <>
    {caseTemplate.map((section) => {
      const values = content[section.key]
      if (!hasValue(values)) return null
      if (!isRecord(values)) return <section key={section.key}><h2>{section.title}</h2><SavedValue value={values} /></section>
      const known = new Set(section.fields.map((field) => field.key))
      return <section key={section.key}>
        <h2>{section.title}</h2>
        {section.fields.map((field) => hasValue(values[field.key]) && <div key={field.key}>
          <h3>{field.key === 'participantCounts' ? 'Legacy participant count' : field.label}</h3>
          <SavedField field={field} value={values[field.key]} />
        </div>)}
        {Object.entries(values).filter(([key, value]) => !known.has(key) && hasValue(value)).map(([key, value]) => (
          <div key={key}><h3>{key === 'participantCounts' ? 'Legacy participant count' : key + ' (additional saved field)'}</h3><SavedValue value={value} /></div>
        ))}
      </section>
    })}
    {Object.entries(content).filter(([key, value]) => !caseTemplate.some((section) => section.key === key) && hasValue(value)).map(([key, value]) => (
      <section key={key}><h2>{key} (additional saved content)</h2><SavedValue value={value} /></section>
    ))}
  </>
}
