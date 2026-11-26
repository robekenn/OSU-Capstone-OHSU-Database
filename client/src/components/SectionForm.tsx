import type { ReactNode } from 'react'
import { caseTemplate } from '../templates/caseTemplate'
import type { CaseContent, FieldValue } from '../templates/caseTemplate'
import type { FormSection } from '../templates/caseSections'
import FieldInput from './FieldInput'

type Props = {
  formSection: FormSection
  content: CaseContent
  readOnlyFields?: ReadonlySet<string>
  // Fields left out of the form entirely, as "templateKey.fieldKey". Used when another
  // control (the campus and course pickers) replaces them. Saved values are not touched.
  hiddenFields?: ReadonlySet<string>
  onChange: (templateKey: string, fieldKey: string, value: FieldValue) => void
}

// Draws every field of one form section. It holds no state of its own: the page owns
// all the content, so nothing is lost when the user moves to another section.
export default function SectionForm({ formSection, content, readOnlyFields, hiddenFields, onChange }: Props) {
  const blocks: ReactNode[] = []

  for (const templateKey of formSection.templateKeys) {
    const template = caseTemplate.find((item) => item.key === templateKey)
    if (!template) continue

    const values = content[templateKey] ?? {}
    const fields: ReactNode[] = []
    for (const field of template.fields) {
      const prefix = `${templateKey}.${field.key}`
      if (hiddenFields?.has(prefix)) continue
      if (readOnlyFields?.has(prefix) || readOnlyFields?.has(prefix + 'Other')) {
        fields.push(<p key={field.key}>{field.label} contains older data. It stays as saved and is visible in case details.</p>)
        continue
      }
      const otherRaw = values[field.key + 'Other']
      const otherValue = typeof otherRaw === 'string' ? otherRaw : ''
      fields.push(
        <FieldInput
          key={field.key}
          sectionKey={templateKey}
          field={field}
          value={values[field.key]}
          otherValue={otherValue}
          onChange={(fieldKey, value) => onChange(templateKey, fieldKey, value)}
        />,
      )
    }

    // A form section that shows several template sections names each one.
    const showSubheading = formSection.templateKeys.length > 1
    blocks.push(
      <div key={templateKey}>
        {showSubheading && <h3>{template.title}</h3>}
        {fields}
      </div>,
    )
  }

  return (
    <section aria-labelledby={'heading-' + formSection.key}>
      <h2 id={'heading-' + formSection.key}>{formSection.title}</h2>
      {blocks}
    </section>
  )
}