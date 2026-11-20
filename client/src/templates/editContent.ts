import { caseTemplate } from './caseTemplate'
import type { CaseContent, Field, FieldValue, TableRow } from './caseTemplate'
import { cleanContent } from './cleanContent'

export type DraftChanges = Record<string, Record<string, FieldValue | null>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function editableValue(field: Field, value: unknown): FieldValue | undefined {
  if (field.kind === 'text' || field.kind === 'textarea') return typeof value === 'string' ? value : undefined
  if (field.kind === 'radio') return typeof value === 'string' && field.options.includes(value) ? value : undefined
  if (!Array.isArray(value)) return undefined
  if (field.kind === 'roles') {
    const rows: TableRow[] = []
    for (const item of value) {
      const row = typeof item === 'string' ? { role: item, detail: '' } : item
      if (!isRecord(row) || typeof row.role !== 'string' || !field.options.includes(row.role)
        || (row.detail !== undefined && typeof row.detail !== 'string')
        || Object.keys(row).some((key) => key !== 'role' && key !== 'detail')
        || rows.some((saved) => saved.role === row.role)) return undefined
      rows.push({ role: row.role, detail: typeof row.detail === 'string' ? row.detail : '' })
    }
    return rows
  }
  if (field.kind === 'table') {
    const columns = new Set(field.columns.map((column) => column.key))
    return value.every((row) => isRecord(row) && Object.entries(row).every(([key, cell]) =>
      columns.has(key) && typeof cell === 'string')) ? value as TableRow[] : undefined
  }
  return value.every((item) => typeof item === 'string' &&
    (field.kind !== 'checkboxes' || field.options.includes(item))) ? value as string[] : undefined
}

// Only load fields the controls can represent without dropping saved data.
// The API keeps untouched fields exactly as stored, including unknown sections.
export function editableDraft(saved: unknown) {
  const content: CaseContent = {}
  const readOnlyFields = new Set<string>()
  const sections = isRecord(saved) ? saved : {}
  for (const section of caseTemplate) {
    const raw = sections[section.key]
    const values = isRecord(raw) ? raw : {}
    const locked = (saved != null && !isRecord(saved)) || (raw !== undefined && !isRecord(raw))
    for (const field of section.fields) {
      const keys = field.kind === 'checkboxes' && field.hasOther ? [field.key, field.key + 'Other'] : [field.key]
      for (const key of keys) {
        if (locked) {
          readOnlyFields.add(`${section.key}.${key}`)
          continue
        }
        if (!Object.hasOwn(values, key)) continue
        const value = values[key]
        const editable = key === field.key ? editableValue(field, value) : typeof value === 'string' ? value : undefined
        if (editable === undefined) readOnlyFields.add(`${section.key}.${key}`)
        else (content[section.key] ??= {})[key] = editable
      }
    }
  }
  return { content, readOnlyFields }
}

export function draftChanges(touched: CaseContent): DraftChanges {
  const cleaned = cleanContent(touched)
  return Object.fromEntries(Object.entries(touched).map(([section, fields]) => [section,
    Object.fromEntries(Object.keys(fields).map((key) => [key, cleaned[section]?.[key] ?? null])),
  ]))
}
