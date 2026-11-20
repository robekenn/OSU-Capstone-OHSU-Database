// Private object storage for case attachments (#63).
//
// Interim decision (design.md section 3.3): a private Supabase Storage bucket in the
// project the app already uses. Everything else talks to the FileStorage interface,
// so an S3 adapter can replace this one if the object-storage RFC is accepted.
// Only the API holds the secret key; the browser only ever sees short-lived signed
// links for one object.

export type StoredObject = { bytes: Buffer; contentType: string | null }

export interface FileStorage {
  // A one-time link the browser PUTs the file to. Supabase keeps it valid for 2 hours.
  createUploadUrl(key: string): Promise<string>
  // The object's bytes, or null if it doesn't exist. Throws TooLargeError past maxBytes.
  read(key: string, maxBytes: number): Promise<StoredObject | null>
  // A link that downloads the object as an attachment named `filename`.
  createDownloadUrl(key: string, filename: string, expiresInSeconds: number): Promise<string>
  remove(keys: string[]): Promise<void>
  // Objects directly inside a folder, with their upload time.
  list(folder: string): Promise<{ key: string; createdAt: Date }[]>
}

export class TooLargeError extends Error {}

export type SupabaseStorageConfig = { url: string; secretKey: string; bucket: string }

export const DEFAULT_BUCKET = 'case-files'

// Returns null when storage isn't configured, so attachment routes can answer 503
// instead of the whole API failing to start.
export function storageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SupabaseStorageConfig | null {
  // Same URL names auth.ts accepts. Vercel's Supabase integration provides
  // SUPABASE_SERVICE_ROLE_KEY; a hand-made server/.env uses SUPABASE_SECRET_KEY.
  const url = env.SUPABASE_URL ?? env.VITE_PUBLIC_SUPABASE_URL
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secretKey) return null
  return { url, secretKey, bucket: env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET }
}

export function supabaseStorage(config: SupabaseStorageConfig): FileStorage {
  const base = new URL('/storage/v1', config.url).toString()
  // Legacy service-role keys are JWTs and go in Authorization as well; the newer
  // sb_secret_ keys are accepted through the apikey header alone.
  const headers: Record<string, string> = { apikey: config.secretKey }
  if (config.secretKey.startsWith('eyJ')) headers.Authorization = `Bearer ${config.secretKey}`

  const objectPath = (key: string) => `${encodeURIComponent(config.bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`

  async function call(path: string, init: RequestInit = {}) {
    const response = await fetch(base + path, {
      ...init,
      headers: { ...headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    })
    return response
  }

  async function json(path: string, body: unknown) {
    const response = await call(path, { method: 'POST', body: JSON.stringify(body) })
    // Never include the response body in the error: it can echo object keys.
    if (!response.ok) throw new Error(`Storage request failed (status ${response.status})`)
    return response.json() as Promise<unknown>
  }

  function absolute(relative: unknown) {
    if (typeof relative !== 'string' || !relative.startsWith('/')) {
      throw new Error('Storage returned an unexpected signed link')
    }
    return base + relative
  }

  return {
    async createUploadUrl(key) {
      const data = await json(`/object/upload/sign/${objectPath(key)}`, {})
      return absolute((data as { url?: unknown }).url)
    },

    async read(key, maxBytes) {
      const response = await call(`/object/${objectPath(key)}`)
      if (response.status === 400 || response.status === 404) return null
      if (!response.ok || !response.body) throw new Error(`Storage read failed (status ${response.status})`)
      const declared = Number(response.headers.get('content-length'))
      if (declared > maxBytes) {
        await response.body.cancel()
        throw new TooLargeError()
      }
      const chunks: Uint8Array[] = []
      let total = 0
      for await (const chunk of response.body) {
        total += chunk.byteLength
        if (total > maxBytes) throw new TooLargeError()
        chunks.push(chunk)
      }
      return { bytes: Buffer.concat(chunks), contentType: response.headers.get('content-type') }
    },

    async createDownloadUrl(key, filename, expiresInSeconds) {
      const data = await json(`/object/sign/${objectPath(key)}`, { expiresIn: expiresInSeconds })
      // download=<name> makes Storage send Content-Disposition: attachment, so a
      // file is always saved, never rendered in the app's or Storage's origin.
      return absolute((data as { signedURL?: unknown }).signedURL) + '&download=' + encodeURIComponent(filename)
    },

    async remove(keys) {
      if (keys.length === 0) return
      const response = await call(`/object/${encodeURIComponent(config.bucket)}`, {
        method: 'DELETE', body: JSON.stringify({ prefixes: keys }),
      })
      if (!response.ok) throw new Error(`Storage delete failed (status ${response.status})`)
    },

    async list(folder) {
      const data = await json(`/object/list/${encodeURIComponent(config.bucket)}`, {
        prefix: folder, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' },
      })
      if (!Array.isArray(data)) throw new Error('Storage returned an unexpected listing')
      return data.flatMap((item: { id?: unknown; name?: unknown; created_at?: unknown }) =>
        // Entries without an id are sub-folders.
        typeof item.name === 'string' && item.id && typeof item.created_at === 'string'
          ? [{ key: `${folder}/${item.name}`, createdAt: new Date(item.created_at) }]
          : [])
    },
  }
}

// Creates the bucket, or resets an existing one, as private with the attachment
// limits, so Storage itself refuses oversized or disallowed uploads before the
// API ever sees them. Run once per Supabase project: npm run storage:setup --workspace server
export async function ensurePrivateBucket(
  config: SupabaseStorageConfig,
  limits: { maxBytes: number; mediaTypes: string[] },
) {
  const headers: Record<string, string> = { apikey: config.secretKey, 'Content-Type': 'application/json' }
  if (config.secretKey.startsWith('eyJ')) headers.Authorization = `Bearer ${config.secretKey}`
  const settings = {
    public: false,
    file_size_limit: limits.maxBytes,
    allowed_mime_types: limits.mediaTypes,
  }
  const base = new URL('/storage/v1', config.url).toString()
  const existing = await fetch(`${base}/bucket/${encodeURIComponent(config.bucket)}`, { headers, redirect: 'error' })
  const response = existing.ok
    ? await fetch(`${base}/bucket/${encodeURIComponent(config.bucket)}`, {
      method: 'PUT', headers, redirect: 'error', body: JSON.stringify(settings),
    })
    : await fetch(`${base}/bucket`, {
      method: 'POST', headers, redirect: 'error',
      body: JSON.stringify({ id: config.bucket, name: config.bucket, ...settings }),
    })
  if (!response.ok) throw new Error(`Could not configure the storage bucket (status ${response.status})`)
  return existing.ok ? 'updated' : 'created'
}
