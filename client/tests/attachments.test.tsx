// Issue #63: attaching files to a case. Every file here is a tiny fictional
// stand-in; none is a real document.
import React from 'react'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { afterEach, test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDownloadUrl, listAttachments, uploadAttachment } from '../src/api/attachments'
import { checkFile, formatBytes, MAX_ATTACHMENT_BYTES, mediaTypeForFilename, typeLabel } from '../src/attachments/rules'
import { AttachmentTable, AttachmentUpload } from '../src/components/CaseAttachments'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const PDF = 'application/pdf'
const syntheticBytes = new TextEncoder().encode('%PDF-1.7\n% Synthetic handout for tests\n%%EOF\n')
const syntheticFile = new File([syntheticBytes], 'Synthetic handout.pdf', { type: PDF })
const expectedSha = createHash('sha256').update(syntheticBytes).digest('hex')
const saved = { id: 31, filename: 'Synthetic handout.pdf', mediaType: PDF, sizeBytes: syntheticBytes.length,
  sha256: expectedSha, uploadedAt: '2026-11-17T12:00:00.000Z' }
const noop = () => {}

test('checks type and size before anything is sent', () => {
  assert.equal(checkFile({ name: 'labs.PDF', size: 10 }), null)
  assert.equal(checkFile({ name: 'slides.pptx', size: MAX_ATTACHMENT_BYTES }), null)
  assert.match(checkFile({ name: 'page.html', size: 10 }) ?? '', /not an allowed file type/)
  assert.match(checkFile({ name: 'macros.docm', size: 10 }) ?? '', /not an allowed file type/)
  assert.match(checkFile({ name: 'big.pdf', size: MAX_ATTACHMENT_BYTES + 1 }) ?? '', /at most 25 MB/)
  assert.match(checkFile({ name: 'empty.pdf', size: 0 }) ?? '', /empty/)
  assert.equal(mediaTypeForFilename('photo.JPG'), 'image/jpeg')
  assert.equal(typeLabel('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'Word')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(2048), '2 KB')
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB')
})

test('uploads straight to storage, then records the file with its checksum', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    if (url === '/api/cases/7/attachments/uploads') {
      return Response.json({ uploadKey: 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c',
        uploadUrl: 'https://storage.example.test/upload?token=synthetic', mediaType: PDF, maxBytes: MAX_ATTACHMENT_BYTES }, { status: 201 })
    }
    if (url.startsWith('https://storage.example.test/')) return Response.json({ Key: 'stored' })
    if (url === '/api/cases/7/attachments') return Response.json(saved, { status: 201 })
    throw new Error('Unexpected request ' + url)
  }
  assert.deepEqual(await uploadAttachment('7', syntheticFile), saved)
  assert.deepEqual(calls.map((call) => call.url), [
    '/api/cases/7/attachments/uploads',
    'https://storage.example.test/upload?token=synthetic',
    '/api/cases/7/attachments',
  ])
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { filename: 'Synthetic handout.pdf', sizeBytes: syntheticBytes.length })

  const put = calls[1].init
  assert.equal(put?.method, 'PUT')
  const putHeaders = new Headers(put?.headers)
  assert.equal(putHeaders.get('Content-Type'), PDF)
  assert.equal(putHeaders.get('Authorization'), null, 'the session token never goes to storage')
  assert.deepEqual(new Uint8Array(put?.body as ArrayBuffer), syntheticBytes)

  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
    uploadKey: 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c', filename: 'Synthetic handout.pdf', sha256: expectedSha,
  })
})

test('a refused file is never sent anywhere', async () => {
  let requests = 0
  globalThis.fetch = async () => { requests += 1; return new Response() }
  await assert.rejects(uploadAttachment('7', new File(['<html></html>'], 'page.html')), /not an allowed file type/)
  assert.equal(requests, 0)
})

test('a failed storage upload is not recorded', async () => {
  const urls: string[] = []
  globalThis.fetch = async (input) => {
    urls.push(String(input))
    if (String(input).endsWith('/uploads')) {
      return Response.json({ uploadKey: 'k', uploadUrl: 'https://storage.example.test/u', mediaType: PDF }, { status: 201 })
    }
    return new Response('', { status: 500 })
  }
  await assert.rejects(uploadAttachment('7', syntheticFile), /refused the upload/)
  assert.equal(urls.length, 2)
})

test('server rejections become plain-language messages', async () => {
  globalThis.fetch = async () => Response.json({ error: 'unsupported_type' }, { status: 400 })
  await assert.rejects(uploadAttachment('7', syntheticFile), /can't be attached/)
  globalThis.fetch = async () => Response.json({ error: 'version_not_editable' }, { status: 409 })
  await assert.rejects(uploadAttachment('7', syntheticFile), /draft version/)
  globalThis.fetch = async () => Response.json({ error: 'storage_unavailable' }, { status: 503 })
  await assert.rejects(uploadAttachment('7', syntheticFile), /isn't set up/)
  globalThis.fetch = async (input) => String(input).endsWith('/uploads')
    ? Response.json({ uploadKey: 'k', uploadUrl: 'http://insecure.example.test/u', mediaType: PDF }, { status: 201 })
    : new Response()
  await assert.rejects(uploadAttachment('7', syntheticFile), /unexpected upload link/)
})

test('lists files and checks the response shape', async () => {
  const list = { versionId: 9, editable: true, files: [saved] }
  globalThis.fetch = async (input) => {
    assert.equal(input, '/api/cases/7/attachments')
    return Response.json(list)
  }
  assert.deepEqual(await listAttachments('7'), list)
  globalThis.fetch = async () => Response.json({ versionId: 9, editable: true, files: [{ id: 'x' }] })
  await assert.rejects(listAttachments('7'), /unexpected/)
  globalThis.fetch = async () => new Response('', { status: 401 })
  await assert.rejects(listAttachments('7'), /Sign in/)
})

test('downloads only follow https links from the API', async () => {
  globalThis.fetch = async (input) => {
    assert.equal(input, '/api/cases/7/attachments/31/download')
    return Response.json({ url: 'https://storage.example.test/d?token=synthetic&download=x.pdf', expiresInSeconds: 60 })
  }
  assert.equal(await getDownloadUrl('7', 31), 'https://storage.example.test/d?token=synthetic&download=x.pdf')
  globalThis.fetch = async () => Response.json({ url: 'javascript:alert(1)' })
  await assert.rejects(getDownloadUrl('7', 31), /unexpected download link/)
})

test('the file list shows name, type, size and date with labelled actions', () => {
  const html = renderToStaticMarkup(<AttachmentTable files={[{ ...saved, filename: '<Synthetic>.pdf' }]}
    editable busy={false} onDownload={noop} onRemove={noop} />)
  for (const text of ['&lt;Synthetic&gt;.pdf', 'PDF', '<th scope="col">Size</th>', 'dateTime="2026-11-17T12:00:00.000Z"',
    'aria-label="Download &lt;Synthetic&gt;.pdf"', 'aria-label="Remove &lt;Synthetic&gt;.pdf"']) {
    assert.ok(html.includes(text), text)
  }
  const readOnly = renderToStaticMarkup(<AttachmentTable files={[saved]} editable={false} busy={false} onDownload={noop} onRemove={noop} />)
  assert.ok(readOnly.includes('Download'))
  assert.ok(!readOnly.includes('Remove'))
  assert.match(renderToStaticMarkup(<AttachmentTable files={[]} editable busy={false} onDownload={noop} onRemove={noop} />), /No files are attached/)
})

test('the upload control carries the no-real-patient-data reminder and allowed types', () => {
  const html = renderToStaticMarkup(<AttachmentUpload busy={false} onChoose={noop} />)
  assert.match(html, /must not contain real patient information/)
  assert.match(html, /<label for="attachment-file">Add a file<\/label>/)
  assert.match(html, /aria-describedby="attachment-privacy attachment-allowed"/)
  assert.match(html, /accept="\.pdf,\.docx,\.pptx,\.xlsx,\.png,\.jpg,\.jpeg"/)
  assert.match(html, /up to 25 MB/)
})
