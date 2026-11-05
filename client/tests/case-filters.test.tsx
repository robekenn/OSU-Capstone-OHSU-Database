// Issue #39: search and filters on the Cases page. All data is synthetic.
import React from 'react'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { InvalidFilterError, filtersToQuery, listCases, listCourses, listOutcomes } from '../src/api/cases'
import { FilterForm } from '../src/pages/CasesPage'
import { describeResults, filtersFromParams } from '../src/pages/caseFilters'
import type { Lookups } from '../src/pages/CasesPage'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const noop = () => {}

test('only filters that are set go into the query string', () => {
  assert.equal(filtersToQuery({}), '')
  assert.equal(filtersToQuery({ search: '  ', course: '' }), '')
  assert.equal(filtersToQuery({ outcome: '3', search: 'sepsis', campus: '2' }), '?search=sepsis&campus=2&outcome=3')
  // Special characters are encoded, so % and & reach the server as text.
  assert.equal(filtersToQuery({ search: '100% & more' }), '?search=100%25+%26+more')
})

test('reads filters from the page URL and ignores other parameters', () => {
  const params = new URLSearchParams('?search=+sepsis+&course=4&campus=&utm=x')
  assert.deepEqual(filtersFromParams(params), { search: 'sepsis', course: '4' })
})

test('listCases sends the filters to the API', async () => {
  let requested = ''
  globalThis.fetch = async (input) => {
    requested = String(input)
    return Response.json([])
  }
  await listCases({ search: 'asthma', course: '1', campus: '2', outcome: '3' })
  assert.equal(requested, '/api/cases?search=asthma&course=1&campus=2&outcome=3')
})

test('a 400 becomes an InvalidFilterError that names the bad filter', async () => {
  globalThis.fetch = async () => Response.json({ error: 'invalid_request', fields: ['course', '<script>'] }, { status: 400 })
  await assert.rejects(listCases({ course: '999' }), (error: unknown) => {
    assert.ok(error instanceof InvalidFilterError)
    assert.match(error.message, /\(course\)/)
    assert.doesNotMatch(error.message, /script/)
    return true
  })
})

test('lookup lists are checked before use', async () => {
  globalThis.fetch = async () => Response.json([{ id: 1, code: 'TEST 101', title: null }])
  assert.deepEqual(await listCourses(), [{ id: 1, code: 'TEST 101', title: null }])
  globalThis.fetch = async () => Response.json([{ id: 1, code: 42, title: null }])
  await assert.rejects(listCourses(), /unexpected/i)
  globalThis.fetch = async () => new Response('', { status: 500 })
  await assert.rejects(listOutcomes(), /500/)
})

test('result count wording', () => {
  assert.equal(describeResults(0, false), 'No cases yet')
  assert.equal(describeResults(0, true), 'No cases match these filters.')
  assert.equal(describeResults(1, true), '1 case matches')
  assert.equal(describeResults(3, true), '3 cases match')
  assert.equal(describeResults(3, false), '3 cases')
})

const lookups: Lookups = {
  kind: 'ready',
  courses: [{ id: 1, code: 'TEST 101', title: 'Synthetic Course' }, { id: 2, code: 'TEST 202', title: null }],
  campuses: [{ id: 5, name: 'Synthetic Campus' }],
  outcomes: [
    { id: 7, framework: 'Test Framework', code: 'TF-1', description: 'Synthetic outcome' },
    { id: 8, framework: 'Test Framework', code: null, description: 'Synthetic uncoded outcome' },
  ],
}

test('the filter form is a labelled search region with an Any option on each dropdown', () => {
  const html = renderToStaticMarkup(
    <FilterForm draft={{}} lookups={lookups} onChange={noop} onSubmit={noop} onClear={noop} />,
  )
  assert.match(html, /<form[^>]*role="search"[^>]*aria-label="Search and filter cases"/)
  for (const [id, label] of [['case-search', 'Search'], ['case-course', 'Course'], ['case-campus', 'Campus'], ['case-outcome', 'Outcome']]) {
    assert.ok(html.includes(`<label for="${id}">${label}</label>`), `label for ${id}`)
    assert.ok(html.includes(`id="${id}"`), `control ${id}`)
  }
  for (const any of ['Any course', 'Any campus', 'Any outcome']) {
    assert.match(html, new RegExp(`<option value=""( selected="")?>${any}</option>`), any)
  }
  assert.ok(html.includes('>TEST 101: Synthetic Course</option>'))
  assert.ok(html.includes('>TEST 202</option>'))
  assert.ok(html.includes('<optgroup label="Test Framework">'))
  assert.ok(html.includes('>TF-1: Synthetic outcome</option>'))
  assert.ok(html.includes('>Synthetic uncoded outcome</option>'))
  assert.match(html, /<button type="submit">Search<\/button>/)
  assert.match(html, /<button type="button">Clear filters<\/button>/)
})

test('the form shows the applied filters and disables dropdowns until their options load', () => {
  const html = renderToStaticMarkup(
    <FilterForm draft={{ search: 'sepsis', course: '2' }} lookups={lookups} onChange={noop} onSubmit={noop} onClear={noop} />,
  )
  assert.match(html, /value="sepsis"/)
  assert.match(html, /<option value="2" selected="">TEST 202<\/option>/)

  const loading = renderToStaticMarkup(
    <FilterForm draft={{}} lookups={{ kind: 'loading' }} onChange={noop} onSubmit={noop} onClear={noop} />,
  )
  assert.equal(loading.match(/<select[^>]* disabled=""/g)?.length, 3)

  const failed = renderToStaticMarkup(
    <FilterForm draft={{}} lookups={{ kind: 'error' }} onChange={noop} onSubmit={noop} onClear={noop} />,
  )
  assert.match(failed, /role="alert"[^>]*>Could not load the course, campus and outcome lists/)
})
