import { caseTemplate } from './caseTemplate'
import type { CaseContent, FieldValue, TableRow } from './caseTemplate'

// Used for new form submissions only. It never rewrites an existing stored version.
export function cleanContent(raw: CaseContent): CaseContent {
  const cleaned: CaseContent = {}
  for (const section of caseTemplate) {
    const values = raw[section.key]
    if (!values) continue
    const cleanValues: Record<string, FieldValue> = {}
    for (const fieldKey of Object.keys(values)) {
      const value = values[fieldKey]
      if (section.fields.find((field) => field.key === fieldKey)?.kind === 'roles' && Array.isArray(value)) {
        const roles = value.filter((row): row is TableRow => typeof row === 'object' && row !== null
          && typeof row.role === 'string' && row.role.trim() !== '' && row.selected !== 'false')
          .map((row) => ({ role: row.role, detail: row.detail ?? '' }))
        if (roles.length) cleanValues[fieldKey] = roles
        continue
      }
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
