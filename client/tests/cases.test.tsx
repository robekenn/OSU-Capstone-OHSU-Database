import React from 'react'
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { listCases } from '../src/api/cases'
import { CasesTable } from '../src/pages/CasesPage'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('loads a newly saved draft using the existing list contract', async () => {
  const draft = { id: 1, title: 'Synthetic demo case', status: 'draft', updatedAt: '2026-11-03T12:00:00Z' }
  globalThis.fetch = async (input, options) => {
    assert.equal(input, '/api/cases')
    assert.ok(options?.signal instanceof AbortSignal)
    return Response.json([draft])
  }
  assert.deepEqual(await listCases(new AbortController().signal), [draft])
})

test('rejects HTTP errors and malformed responses instead of showing an empty list', async () => {
  globalThis.fetch = async () => new Response('', { status: 503 })
  await assert.rejects(listCases(), /503/)
  globalThis.fetch = async () => Response.json({ unexpected: true })
  await assert.rejects(listCases(), /unexpected/i)
  globalThis.fetch = async () => Response.json([{ id: 1, title: 'Synthetic', status: 42, updatedAt: null }])
  await assert.rejects(listCases(), /unexpected/i)
})

test('renders an accessible table with escaped titles and readable status', () => {
  const html = renderToStaticMarkup(<CasesTable cases={[
    { id: 1, title: '<Synthetic>', status: 'draft', updatedAt: '2026-11-03T12:00:00Z' },
    { id: 2, title: 'Synthetic unversioned case', status: null, updatedAt: null },
  ]} />)
  assert.match(html, /<caption>Simulation cases<\/caption>/)
  for (const heading of ['Title', 'Status', 'Last updated']) {
    assert.ok(html.includes('<th scope="col">' + heading + '</th>'))
  }
  assert.match(html, /&lt;Synthetic&gt;/)
  assert.match(html, /draft/)
  assert.match(html, /<time dateTime="2026-11-03T12:00:00Z">/)
  assert.match(html, /Not available/)
})

test('shows the specified empty state', () => {
  assert.match(renderToStaticMarkup(<CasesTable cases={[]} />), /No cases yet/)
})

