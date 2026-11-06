import type { Field, FieldValue, TableRow } from '../templates/caseTemplate'

type Props = {
  sectionKey: string
  field: Field
  value: FieldValue | undefined
  otherValue: string
  onChange: (fieldKey: string, value: FieldValue) => void
}

// Draws one field from the template. The kind decides which inputs appear.
export default function FieldInput({ sectionKey, field, value, otherValue, onChange }: Props) {
  const id = sectionKey + '-' + field.key
  const helpId = id + '-help'
  const help = 'help' in field ? field.help : undefined

  if (field.kind === 'text' || field.kind === 'textarea') {
    const current = typeof value === 'string' ? value : ''
    return (
      <div className="field">
        <label htmlFor={id}>{field.label}</label>
        {help && <p className="help" id={helpId}>{help}</p>}
        {field.kind === 'text' ? (
          <input
            id={id}
            type="text"
            value={current}
            aria-describedby={help ? helpId : undefined}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        ) : (
          <textarea
            id={id}
            value={current}
            aria-describedby={help ? helpId : undefined}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        )}
      </div>
    )
  }

  if (field.kind === 'radio') {
    const current = typeof value === 'string' ? value : ''
    return (
      <fieldset className="field">
        <legend>{field.label}</legend>
        {field.options.map((option) => (
          <label key={option} className="option">
            <input
              type="radio"
              name={id}
              value={option}
              checked={current === option}
              onChange={() => onChange(field.key, option)}
            />{' '}
            {option}
          </label>
        ))}
      </fieldset>
    )
  }

  if (field.kind === 'checkboxes') {
    const selected: string[] = Array.isArray(value) ? (value as string[]) : []
    return (
      <fieldset className="field">
        <legend>{field.label}</legend>
        {field.options.map((option) => (
          <label key={option} className="option">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange(field.key, [...selected, option])
                } else {
                  onChange(field.key, selected.filter((item) => item !== option))
                }
              }}
            />{' '}
            {option}
          </label>
        ))}
        {field.hasOther && (
          <div>
            <label htmlFor={id + '-other'}>Other (describe)</label>
            <input
              id={id + '-other'}
              type="text"
              value={otherValue}
              onChange={(event) => onChange(field.key + 'Other', event.target.value)}
            />
          </div>
        )}
      </fieldset>
    )
  }

  if (field.kind === 'list') {
    const items: string[] = Array.isArray(value) ? (value as string[]) : []
    return (
      <fieldset className="field">
        <legend>{field.label}</legend>
        {help && <p className="help">{help}</p>}
        {items.map((item, index) => (
          <div key={index} className="row">
            <label htmlFor={id + '-' + index}>{field.itemLabel + ' ' + (index + 1)}</label>
            <input
              id={id + '-' + index}
              type="text"
              value={item}
              onChange={(event) => {
                const next = [...items]
                next[index] = event.target.value
                onChange(field.key, next)
              }}
            />
            <button type="button" onClick={() => onChange(field.key, items.filter((_item, i) => i !== index))}>
              Remove {field.itemLabel.toLowerCase()} {index + 1}
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange(field.key, [...items, ''])}>
          Add {field.itemLabel.toLowerCase()}
        </button>
      </fieldset>
    )
  }

  if (field.kind === 'roles') {
    const rows = (Array.isArray(value) ? value : []).filter(
      (item): item is TableRow => typeof item === 'object' && item !== null && typeof item.role === 'string',
    )
    const changeRole = (role: string, patch: Partial<TableRow>) => {
      const existing = rows.find((row) => row.role === role)
      const next = { role, detail: '', ...existing, ...patch }
      onChange(field.key, existing ? rows.map((row) => row.role === role ? next : row) : [...rows, next])
    }
    return <fieldset className="field">
      <legend>{field.label}</legend>
      {field.options.map((role, index) => {
        const row = rows.find((item) => item.role === role)
        const checked = row !== undefined && row.selected !== 'false'
        const roleId = id + '-' + index
        return <div key={role} className="role-entry">
          <label className="option"><input type="checkbox" checked={checked}
            onChange={(event) => changeRole(role, { selected: String(event.target.checked) })} />{' '}{role}</label>
          <label htmlFor={roleId}>{role}: {field.detailLabel}</label>
          <input id={roleId} type="text" value={row?.detail ?? ''} disabled={!checked}
            onChange={(event) => changeRole(role, { detail: event.target.value })} />
        </div>
      })}
    </fieldset>
  }

  // Everything left is a table.
  const rows: TableRow[] = Array.isArray(value) ? (value as TableRow[]) : []

  const changeCell = (rowIndex: number, columnKey: string, cellValue: string) => {
    const next = rows.map((existing, i) => (i === rowIndex ? { ...existing, [columnKey]: cellValue } : existing))
    onChange(field.key, next)
  }

  return (
    <fieldset className="field">
      <legend>{field.label}</legend>
      {help && <p className="help">{help}</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {field.columns.map((column) => (
                  <th key={column.key} scope="col">{column.label}</th>
                ))}
                <th scope="col">Remove</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {field.columns.map((column) => {
                    const cell = row[column.key] ?? ''
                    const cellLabel = column.label + ', row ' + (rowIndex + 1)
                    return (
                      <td key={column.key}>
                        {column.multiline ? (
                          <textarea
                            aria-label={cellLabel}
                            value={cell}
                            onChange={(event) => changeCell(rowIndex, column.key, event.target.value)}
                          />
                        ) : (
                          <input
                            type="text"
                            aria-label={cellLabel}
                            value={cell}
                            onChange={(event) => changeCell(rowIndex, column.key, event.target.value)}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td>
                    <button type="button" onClick={() => onChange(field.key, rows.filter((_row, i) => i !== rowIndex))}>
                      Remove row {rowIndex + 1}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={() => onChange(field.key, [...rows, {}])}>
        Add row
      </button>
    </fieldset>
  )
}
