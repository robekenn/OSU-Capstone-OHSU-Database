import React from 'react'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { getCase } from '../src/api/cases'
import { CaseContentView } from '../src/components/CaseContentView'
import { casesReturnTo } from '../src/pages/caseFilters'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('reads the current case and handles missing, forbidden, and malformed responses', async () => {
  const detail = { id: 7, title: 'Synthetic case', currentVersion: {
    id: 9, versionNumber: 1, status: 'draft', createdAt: '2026-11-06T12:00:00Z',
    content: { patientChart: { allergies: 'Synthetic allergy' } },
  } }
  globalThis.fetch = async (input, options) => {
    assert.equal(input, '/api/cases/7')
    assert.ok(options?.signal instanceof AbortSignal)
    return Response.json(detail)
  }
  assert.deepEqual(await getCase('7', new AbortController().signal), detail)
  globalThis.fetch = async () => new Response('', { status: 404 })
  await assert.rejects(getCase('7'), /not found/i)
  globalThis.fetch = async () => new Response('', { status: 403 })
  await assert.rejects(getCase('7'), /permission/i)
  globalThis.fetch = async () => Response.json({ ...detail, currentVersion: { status: 'draft' } })
  await assert.rejects(getCase('7'), /unexpected/i)
})

test('allows an existing case with no current version', async () => {
  const detail = { id: 7, title: 'Synthetic unversioned case', currentVersion: null }
  globalThis.fetch = async () => Response.json(detail)
  assert.deepEqual(await getCase('7'), detail)
})

test('renders template fields in order and keeps legacy and unknown content', () => {
  const html = renderToStaticMarkup(<CaseContentView content={{
    patientChart: { allergies: '<Synthetic>', historyOfPresentIllness: 'First line\nSecond line' },
    generalInformation: { campus: 'Synthetic Campus' },
    roles: { participants: ['Observers'], participantCounts: '6-10' },
    orders: { medications: [{ name: 'Synthetic medication', dose: 'Example only' }] },
    legacySection: { oldField: 'Keep this legacy value', zero: 0, flag: false },
    debriefing: { retiredField: 'Keep this unknown field' },
  }} />)
  assert.ok(html.indexOf('General Information') < html.indexOf('Patient Chart'))
  for (const value of ['&lt;Synthetic&gt;', 'First line\nSecond line', 'Synthetic medication',
    'Example only', '6-10', 'Keep this legacy value', 'Keep this unknown field', 'false']) {
    assert.ok(html.includes(value), value)
  }
  assert.match(html, /<table/)
  assert.match(html, /<th scope="col">Name<\/th>/)
  assert.match(html, /Legacy participant count/)
})

test('does not lose meaningful scalar or unexpected content shapes', () => {
  for (const content of [false, 0, 'Legacy body', ['Legacy list'], { generalInformation: 'Old section text' }]) {
    const html = renderToStaticMarkup(<CaseContentView content={content} />)
    assert.ok(html.includes(typeof content === 'string' ? content : Array.isArray(content) ? 'Legacy list'
      : typeof content === 'object' ? 'Old section text' : String(content)))
  }
})

test('return link preserves list filters and rejects other destinations', () => {
  assert.equal(casesReturnTo('/cases?search=synthetic&campus=1'), '/cases?search=synthetic&campus=1')
  for (const value of [null, '//example.test', '/new', 'https://example.test', '/cases/3']) {
    assert.equal(casesReturnTo(value), '/cases')
  }
})
