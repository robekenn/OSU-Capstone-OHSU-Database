import { checkFile, mediaTypeForFilename } from '../attachments/rules'
import { appFetch } from './http'

export type Attachment = {
  id: number
  filename: string
  mediaType: string
  sizeBytes: number
  sha256: string
  uploadedAt: string
}

export type AttachmentList = {
  versionId: number | null
  editable: boolean
  files: Attachment[]
}

// What each API error code means for the person using the page.
const MESSAGES: Record<string, string> = {
  unsupported_type: 'That file type can\'t be attached, or its contents don\'t match its name. Macro-enabled Office files aren\'t allowed.',
  file_too_large: 'That file is larger than 25 MB.',
  checksum_mismatch: 'The file was changed or damaged during upload. Please try again.',
  upload_not_found: 'The upload didn\'t finish. Please try again.',
  version_not_editable: 'Files can only be added or removed on a draft version.',
  stale_version: 'This case has a newer version. Reload the page before changing its attachments.',
  storage_unavailable: 'File storage isn\'t set up on this server yet, so attachments are unavailable.',
  already_attached: 'That file was already attached.',
  not_found: 'That case or file no longer exists.',
}

async function failure(response: Response, fallback: string): Promise<Error> {
  if (response.status === 401) return new Error('Sign in to work with attachments.')
  if (response.status === 403) return new Error('You do not have permission to work with attachments.')
  const body: unknown = await response.json().catch(() => null)
  const code = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined
  return new Error((typeof code === 'string' && MESSAGES[code]) || fallback + ' (status ' + response.status + ').')
}

function isAttachment(value: unknown): value is Attachment {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'number' && typeof item.filename === 'string' && typeof item.mediaType === 'string'
    && typeof item.sizeBytes === 'number' && typeof item.sha256 === 'string' && typeof item.uploadedAt === 'string'
}

// Storage links must be https; plain http is allowed only for a local Supabase.
function isStorageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch {
    return false
  }
}

const base = (caseId: string) => '/api/cases/' + encodeURIComponent(caseId) + '/attachments'
const versionQuery = (versionId?: number) => versionId === undefined ? '' : '?versionId=' + versionId

export async function listAttachments(caseId: string, signal?: AbortSignal, versionId?: number): Promise<AttachmentList> {
  const response = await appFetch(base(caseId) + versionQuery(versionId), { signal })
  if (!response.ok) throw await failure(response, 'Could not load attachments')
  const data: unknown = await response.json()
  if (data && typeof data === 'object') {
    const list = data as Record<string, unknown>
    if ((list.versionId === null || typeof list.versionId === 'number') && typeof list.editable === 'boolean'
      && Array.isArray(list.files) && list.files.every(isAttachment)) return data as AttachmentList
  }
  throw new Error('The server returned an unexpected attachment list.')
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Uploads go straight to private storage through a one-time signed link, then the
// API checks what arrived (type, size, checksum) before listing it. If any step
// fails, the API deletes what was stored, so nothing half-uploaded is kept.
export async function uploadAttachment(caseId: string, file: File, versionId?: number): Promise<Attachment> {
  const problem = checkFile(file)
  if (problem) throw new Error(problem)

  const bytes = await file.arrayBuffer()
  const sha256 = await sha256Hex(bytes)

  const signed = await appFetch(base(caseId) + '/uploads' + versionQuery(versionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, sizeBytes: file.size }),
  })
  if (!signed.ok) throw await failure(signed, 'Could not start the upload')
  const { uploadKey, uploadUrl, mediaType } = await signed.json() as { uploadKey?: unknown; uploadUrl?: unknown; mediaType?: unknown }
  if (typeof uploadKey !== 'string' || !isStorageUrl(uploadUrl)
    || typeof mediaType !== 'string' || mediaType !== mediaTypeForFilename(file.name)) {
    throw new Error('The server returned an unexpected upload link.')
  }

  // The signed link is the only credential storage needs; no session token is sent.
  let stored: Response
  try {
    stored = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mediaType, 'x-upsert': 'false' },
      body: bytes,
      redirect: 'error',
    })
  } catch {
    throw new Error('The upload couldn\'t reach file storage. Check your connection and try again.')
  }
  if (!stored.ok) {
    throw new Error(stored.status === 413 ? MESSAGES.file_too_large : 'File storage refused the upload (status ' + stored.status + ').')
  }

  const saved = await appFetch(base(caseId) + versionQuery(versionId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadKey, filename: file.name, sha256 }),
  })
  if (!saved.ok) throw await failure(saved, 'Could not save the attachment')
  const attachment: unknown = await saved.json()
  if (!isAttachment(attachment)) throw new Error('The server returned an unexpected attachment.')
  return attachment
}

// A link valid for about a minute that downloads the file.
export async function getDownloadUrl(caseId: string, fileId: number): Promise<string> {
  const response = await appFetch(base(caseId) + '/' + fileId + '/download')
  if (!response.ok) throw await failure(response, 'Could not download the file')
  const data = await response.json() as { url?: unknown }
  if (!isStorageUrl(data.url)) {
    throw new Error('The server returned an unexpected download link.')
  }
  return data.url
}

export async function removeAttachment(caseId: string, fileId: number, versionId?: number): Promise<void> {
  const response = await appFetch(base(caseId) + '/' + fileId + versionQuery(versionId), { method: 'DELETE' })
  if (!response.ok) throw await failure(response, 'Could not remove the file')
}
