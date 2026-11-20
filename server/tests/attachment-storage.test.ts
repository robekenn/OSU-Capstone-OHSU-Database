import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ensurePrivateBucket, storageConfigFromEnv, supabaseStorage, TooLargeError } from '../src/attachments/storage.js'

const config = { url: 'https://synthetic.example.test', secretKey: 'sb_secret_synthetic_placeholder', bucket: 'case-files' }
const key = 'cases/7/0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c'
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals() })

test('is unavailable until the server-only secret key is configured', () => {
  expect(storageConfigFromEnv({ SUPABASE_URL: config.url })).toBeNull()
  expect(storageConfigFromEnv({ SUPABASE_URL: config.url, SUPABASE_SECRET_KEY: 'k' }))
    .toEqual({ url: config.url, secretKey: 'k', bucket: 'case-files' })
  expect(storageConfigFromEnv({ SUPABASE_URL: config.url, SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_STORAGE_BUCKET: 'other' }))
    .toEqual({ url: config.url, secretKey: 'k', bucket: 'other' })
})

test('signs an upload for one object with the secret key in a header, never the URL', async () => {
  fetchMock.mockResolvedValue(Response.json({ url: `/object/upload/sign/case-files/${key}?token=synthetic` }))
  const url = await supabaseStorage(config).createUploadUrl(key)
  expect(url).toBe(`https://synthetic.example.test/storage/v1/object/upload/sign/case-files/${key}?token=synthetic`)
  const [requested, init] = fetchMock.mock.calls[0]
  expect(requested).toBe(`https://synthetic.example.test/storage/v1/object/upload/sign/case-files/${key}`)
  expect(init.method).toBe('POST')
  expect(init.headers.apikey).toBe(config.secretKey)
  expect(init.headers.Authorization).toBeUndefined() // only JWT-style legacy keys use Authorization
  expect(url).not.toContain(config.secretKey)
})

test('download links are short-lived and always download as an attachment', async () => {
  fetchMock.mockResolvedValue(Response.json({ signedURL: `/object/sign/case-files/${key}?token=synthetic` }))
  const url = await supabaseStorage(config).createDownloadUrl(key, 'Synthetic labs & notes.pdf', 60)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expiresIn: 60 })
  expect(url).toBe(`https://synthetic.example.test/storage/v1/object/sign/case-files/${key}?token=synthetic`
    + '&download=Synthetic%20labs%20%26%20notes.pdf')
})

test('reads stored bytes and stops at the size limit', async () => {
  const bytes = Buffer.from('%PDF-1.7 synthetic')
  fetchMock.mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'application/pdf' } }))
  const stored = await supabaseStorage(config).read(key, 100)
  expect(stored?.bytes.equals(bytes)).toBe(true)
  expect(stored?.contentType).toBe('application/pdf')

  fetchMock.mockResolvedValueOnce(new Response(Buffer.alloc(101)))
  await expect(supabaseStorage(config).read(key, 100)).rejects.toBeInstanceOf(TooLargeError)

  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
  expect(await supabaseStorage(config).read(key, 100)).toBeNull()

  fetchMock.mockResolvedValueOnce(new Response('internal detail', { status: 500 }))
  // The error names the status only; Storage's response body is never echoed.
  await expect(supabaseStorage(config).read(key, 100)).rejects.toThrow(/^Storage read failed \(status 500\)$/)
})

test('removes by exact key and lists only files with their upload time', async () => {
  fetchMock.mockResolvedValueOnce(Response.json([]))
  await supabaseStorage(config).remove([key])
  expect(fetchMock.mock.calls[0][0]).toBe('https://synthetic.example.test/storage/v1/object/case-files')
  expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prefixes: [key] })

  fetchMock.mockResolvedValueOnce(Response.json([
    { name: '0b8f2a1e-4c1d-4e6a-9b7c-1d2e3f4a5b6c', id: 'x', created_at: '2026-11-17T10:00:00Z' },
    { name: 'subfolder', id: null },
  ]))
  expect(await supabaseStorage(config).list('cases/7')).toEqual([
    { key, createdAt: new Date('2026-11-17T10:00:00Z') },
  ])
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ prefix: 'cases/7' })
})

test('bucket setup creates a private bucket with the type and size limits', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
  fetchMock.mockResolvedValueOnce(Response.json({ name: 'case-files' }))
  expect(await ensurePrivateBucket(config, { maxBytes: 26214400, mediaTypes: ['application/pdf'] })).toBe('created')
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    id: 'case-files', name: 'case-files', public: false, file_size_limit: 26214400, allowed_mime_types: ['application/pdf'],
  })

  fetchMock.mockResolvedValueOnce(Response.json({ id: 'case-files', public: true }))
  fetchMock.mockResolvedValueOnce(Response.json({ message: 'ok' }))
  expect(await ensurePrivateBucket(config, { maxBytes: 1, mediaTypes: [] })).toBe('updated')
  expect(fetchMock.mock.calls[3][1].method).toBe('PUT')
  expect(JSON.parse(fetchMock.mock.calls[3][1].body).public).toBe(false)
})
