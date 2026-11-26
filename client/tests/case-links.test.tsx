// Issue #77: typed campus and course inputs on the New case form. All data is synthetic.
import React from 'react'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createCase } from '../src/api/cases'
import CaseLinks from '../src/components/CaseLinks'
import SectionForm from '../src/components/SectionForm'
import { formSections } from '../src/templates/caseSections'
import { displayCopy, emptyLinkChoices, linksProblem, outcomesFromContent, toCaseLinks } from '../src/templates/caseLinks'
import type { Lookups } from '../src/pages/CasesPage'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const noop = () => {}

const suggestions: Lookups = {
  kind: 'ready',
  courses: [{ id: 1, code: 'TEST 101', title: null }, { id: 2, code: 'TEST 202', title: null }],
  campuses: [{ id: 5, name: 'Synthetic Campus' }],
  outcomes: [],
}

test('a campus needs a course and a course needs a campus', () => {
  assert.equal(linksProblem(emptyLinkChoices), '')
  assert.equal(linksProblem({ campus: 'Synthetic Campus', courses: ['TEST 101'] }), '')
  assert.match(linksProblem({ campus: 'Synthetic Campus', courses: [] }), /at least one course/)
  assert.match(linksProblem({ campus: 'Synthetic Campus', courses: ['  '] }), /at least one course/)
  assert.match(linksProblem({ campus: '  ', courses: ['TEST 101'] }), /Enter a campus/)
})

test('outcomes come from the learning outcomes list, skipping blanks', () => {
  assert.deepEqual(outcomesFromContent({ learningOutcomes: { outcomes: ['Synthetic one', '  ', 'Synthetic  two'] } }), ['Synthetic one', 'Synthetic two'])
  assert.deepEqual(outcomesFromContent({}), [])
})

test('typed choices become the fields the API expects, tidied, and no campus is left out', () => {
  assert.deepEqual(
    toCaseLinks({ campus: ' Synthetic   Campus ', courses: ['TEST  101', ''] }, { learningOutcomes: { outcomes: ['Synthetic one'] } }),
    { campus: 'Synthetic Campus', courses: ['TEST 101'], outcomes: ['Synthetic one'] },
  )
  assert.deepEqual(toCaseLinks(emptyLinkChoices, {}), { courses: [], outcomes: [] })
})

test('the readable copy names the campus and lists the courses', () => {
  assert.deepEqual(displayCopy({ campus: 'Synthetic Campus', courses: ['TEST 101', 'TEST 202'] }),
    { campus: 'Synthetic Campus', course: 'TEST 101, TEST 202' })
  assert.deepEqual(displayCopy(emptyLinkChoices), {})
})

test('createCase sends the typed links beside the content', async () => {
  let body: unknown
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body))
    return Response.json({ id: 1, versionId: 2 }, { status: 201 })
  }
  await createCase('Synthetic case', { generalInformation: { campus: 'Synthetic Campus' } },
    { campus: 'Synthetic Campus', courses: ['TEST 101'], outcomes: ['Synthetic one'] })
  assert.deepEqual(body, {
    title: 'Synthetic case',
    content: { generalInformation: { campus: 'Synthetic Campus' } },
    campus: 'Synthetic Campus', courses: ['TEST 101'], outcomes: ['Synthetic one'],
  })
})

test('a 400 about the links explains the campus and course rule', async () => {
  globalThis.fetch = async () => Response.json({ error: 'invalid_request', fields: ['courses'] }, { status: 400 })
  await assert.rejects(createCase('Synthetic case', {}, { campus: 'Synthetic Campus', courses: [], outcomes: [] }), /needs at least one course/)
  globalThis.fetch = async () => new Response('', { status: 500 })
  await assert.rejects(createCase('Synthetic case', {}), /500/)
})

test('the inputs are labelled, offer existing campuses and courses as suggestions, and keep typed values', () => {
  const html = renderToStaticMarkup(
    <CaseLinks suggestions={suggestions} choices={{ campus: 'Portland', courses: ['NRS 424', ''] }} error="" onChange={noop} />,
  )
  assert.ok(html.includes('<label for="case-campus">Campus</label>'))
  assert.ok(html.includes('value="Portland"'))
  assert.ok(html.includes('<legend>Courses</legend>'))
  assert.ok(html.includes('>Course 1</label>'))
  assert.ok(html.includes('>Course 2</label>'))
  assert.ok(html.includes('value="NRS 424"'))
  assert.ok(html.includes('<option value="Synthetic Campus"></option>'))
  assert.ok(html.includes('<option value="TEST 202"></option>'))
  assert.ok(html.includes('Add course'))
})

test('the inputs still work with no suggestions, and show a problem message', () => {
  const html = renderToStaticMarkup(
    <CaseLinks suggestions={{ kind: 'loading' }} choices={emptyLinkChoices} error="Enter a campus for the courses." onChange={noop} />,
  )
  assert.ok(html.includes('<label for="case-campus">Campus</label>'))
  assert.ok(!html.includes('<option'))
  assert.match(html, /id="case-links-error" class="error" role="alert">Enter a campus for the courses\./)
})

test('hidden fields are left out of the form, and shown when not hidden', () => {
  const general = formSections.find((section) => section.key === 'general')
  assert.ok(general)
  const hidden = renderToStaticMarkup(
    <SectionForm formSection={general} content={{}} hiddenFields={new Set(['generalInformation.campus', 'generalInformation.course'])} onChange={noop} />,
  )
  assert.ok(!hidden.includes('>Campus</label>'))
  assert.ok(!hidden.includes('>Course</label>'))
  assert.ok(hidden.includes('>Discipline</label>'))
  const shown = renderToStaticMarkup(<SectionForm formSection={general} content={{}} onChange={noop} />)
  assert.ok(shown.includes('>Campus</label>'))
  assert.ok(shown.includes('>Course</label>'))
})