import React from 'react'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import SectionForm from '../src/components/SectionForm'
import { formSections, titleProblem } from '../src/templates/caseSections'
import { caseTemplate } from '../src/templates/caseTemplate'
import { editableDraft, draftChanges } from '../src/templates/editContent'

test('there are ten form sections in the order the issue lists', () => {
  assert.deepEqual(formSections.map((section) => section.title), [
    'General information',
    'Learning outcomes and objectives',
    'Patient chart',
    'Orders and medications',
    'Simulation operations',
    'Roles',
    'Prebriefing',
    'Scenario progression',
    'Debriefing',
    'Evaluation',
  ])
})

test('every template section appears exactly once, in template order', () => {
  const shown: string[] = []
  for (const section of formSections) {
    for (const key of section.templateKeys) shown.push(key)
  }
  const expected = caseTemplate.map((section) => section.key)
  assert.deepEqual(shown, expected)
})

test('a missing title names the section and the field', () => {
  assert.match(titleProblem('   '), /General information/)
  assert.match(titleProblem(''), /Title/)
  assert.equal(titleProblem('Synthetic case'), '')
})

test('a section shows saved values and labelled fields', () => {
  const chart = formSections.find((section) => section.key === 'chart')!
  const content = { patientChart: { patientName: 'Synthetic Patient' } }
  const html = renderToStaticMarkup(
    <SectionForm formSection={chart} content={content} onChange={() => {}} />,
  )
  assert.ok(html.includes('Synthetic Patient'))
  assert.match(html, /<label for="patientChart-patientName"/)
  assert.ok(html.includes('Patient chart'))
})

test('a section that covers several template sections names each one', () => {
  const simOps = formSections.find((section) => section.key === 'simOps')!
  const html = renderToStaticMarkup(
    <SectionForm formSection={simOps} content={{}} onChange={() => {}} />,
  )
  assert.ok(html.includes('Simulation Operations: Patient Details'))
})

test('a saved draft loads both role formats and preserves fields the form cannot represent', () => {
  const draft = editableDraft({
    roles: { participants: ['Observers'], educatorsStaff: [{ role: 'Lead Facilitator', detail: 'Synthetic detail' }] },
    orders: { medications: [{ name: 'Synthetic example', retiredColumn: 'Keep this' }] },
    retiredSection: { oldValue: true },
  })
  const roles = formSections.find((section) => section.key === 'roles')!
  const html = renderToStaticMarkup(<SectionForm formSection={roles} content={draft.content} onChange={() => {}} />)
  assert.match(html, /checked=""\/>.*Observers/)
  assert.match(html, /value="Synthetic detail"/)
  assert.ok(draft.readOnlyFields.has('orders.medications'))
  assert.equal(draft.content.retiredSection, undefined)
  assert.deepEqual(draftChanges({ roles: { participants: [{ role: 'Observers', detail: '8' }] },
    generalInformation: { campus: '' } }), {
    roles: { participants: [{ role: 'Observers', detail: '8' }] }, generalInformation: { campus: null },
  })
})
