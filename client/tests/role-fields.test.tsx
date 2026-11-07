import React from 'react'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import FieldInput from '../src/components/FieldInput'
import { CaseContentView } from '../src/components/CaseContentView'
import { caseTemplate } from '../src/templates/caseTemplate'
import { cleanContent } from '../src/templates/cleanContent'

test('three role groups share labelled role-with-text fields', () => {
  const section = caseTemplate.find((item) => item.key === 'roles')!
  const groups = section.fields.filter((field) => field.kind === 'roles')
  assert.equal(groups.length, 3)
  assert.ok(!section.fields.some((field) => field.key === 'participantCounts'))
  for (const field of groups) {
    const html = renderToStaticMarkup(<FieldInput sectionKey="roles" field={field}
      value={[{ role: field.options[0], detail: '' }]} otherValue="" onChange={() => {}} />)
    for (const role of field.options) assert.ok(html.includes(role))
    assert.match(html, /type="checkbox"/)
    assert.match(html, /type="text"/)
    assert.match(html, /<label for="roles-/)
    assert.ok(html.includes(field.detailLabel))
  }
})

test('saves independent role text, ranges, and selected roles with no detail', () => {
  const raw = { roles: {
    participants: [
      { role: 'Observers', detail: '6-10', selected: 'true' },
      { role: 'Recorder', detail: '', selected: 'true' },
      { role: 'Primary Active Participants', detail: 'Do not save this', selected: 'false' },
    ],
    patientEmbedded: [{ role: 'Charge Nurse', detail: 'Synthetic faculty role' }],
    educatorsStaff: [{ role: 'Lead Facilitator', detail: 'Synthetic facilitator role' }],
  } }
  const copy = structuredClone(raw)
  const saved = cleanContent(raw)
  assert.deepEqual(saved.roles.participants, [
    { role: 'Observers', detail: '6-10' }, { role: 'Recorder', detail: '' },
  ])
  assert.deepEqual(raw, copy)
  const html = renderToStaticMarkup(<CaseContentView content={saved} />)
  for (const text of ['6-10', 'Not filled in', 'Synthetic faculty role', 'Synthetic facilitator role']) {
    assert.ok(html.includes(text))
  }
  assert.ok(!html.includes('Do not save this'))
})

test('legacy selections and shared counts remain readable without being rewritten', () => {
  const old = { roles: { participants: ['Observers', 'Recorder'], participantCounts: '6-10',
    patientEmbedded: ['Other Healthcare Professional(s)'], patientEmbeddedOther: 'Synthetic therapist role',
    educatorsStaff: ['Lead Facilitator'] } }
  const copy = structuredClone(old)
  const html = renderToStaticMarkup(<CaseContentView content={old} />)
  for (const text of ['Observers', 'Recorder', '6-10', 'Synthetic therapist role', 'Legacy participant count']) {
    assert.ok(html.includes(text))
  }
  assert.deepEqual(old, copy)
})

test('empty form cleanup retains the existing text/list/table behavior', () => {
  assert.deepEqual(cleanContent({ patientChart: { allergies: ' ', homeMedications: [
    { name: '', dose: '' }, { name: 'Synthetic medication', dose: 'Example only' },
  ] }, learningOutcomes: { outcomes: ['', 'Synthetic outcome'] } }), {
    patientChart: { homeMedications: [{ name: 'Synthetic medication', dose: 'Example only' }] },
    learningOutcomes: { outcomes: ['Synthetic outcome'] },
  })
})
