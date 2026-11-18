// Which files may be attached to a case (#63). design.md section 3.3 records the
// decision; db/schema.sql (case_file) enforces the same type list and size limit.
// client/src/attachments/rules.ts mirrors these for early feedback only.

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export const MEDIA_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpeg: 'image/jpeg',
} as const

export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES]

const BY_EXTENSION: Record<string, MediaType> = {
  pdf: MEDIA_TYPES.pdf,
  docx: MEDIA_TYPES.docx,
  pptx: MEDIA_TYPES.pptx,
  xlsx: MEDIA_TYPES.xlsx,
  png: MEDIA_TYPES.png,
  jpg: MEDIA_TYPES.jpeg,
  jpeg: MEDIA_TYPES.jpeg,
}

// The media type implied by a filename's extension, or null if it isn't allowed.
export function mediaTypeForFilename(filename: string): MediaType | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename)
  return match ? BY_EXTENSION[match[1].toLowerCase()] ?? null : null
}

// A display name that is safe to store and to offer as a download name: no path,
// no control or bidirectional-override characters, trimmed, at most 255 characters.
// Returns null when nothing usable is left. The storage key never uses this name.
export function cleanFilename(raw: string): string | null {
  const base = raw.split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩"]/g, '').trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') return null
  if (cleaned.length <= 255) return cleaned
  // Keep the extension when shortening a very long name.
  const dot = cleaned.lastIndexOf('.')
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : ''
  return cleaned.slice(0, 255 - extension.length).trim() + extension
}

function startsWith(bytes: Uint8Array, prefix: number[]) {
  return bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value)
}

function containsAscii(bytes: Buffer, text: string) {
  return bytes.indexOf(text, 0, 'latin1') !== -1
}

// Works out a file's type from its bytes, never from its name or a browser claim.
// Office files are ZIP archives; entry names are stored uncompressed, so the main
// part of each format can be found directly. Macro-enabled Office files (which
// carry vbaProject.bin) are refused even when renamed to .docx/.pptx/.xlsx.
export function sniffMediaType(bytes: Buffer): MediaType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return MEDIA_TYPES.pdf // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return MEDIA_TYPES.png
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return MEDIA_TYPES.jpeg
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (containsAscii(bytes, 'vbaProject.bin')) return null
    const parts: [string, MediaType][] = [
      ['word/document.xml', MEDIA_TYPES.docx],
      ['ppt/presentation.xml', MEDIA_TYPES.pptx],
      ['xl/workbook.xml', MEDIA_TYPES.xlsx],
    ]
    const found = parts.filter(([part]) => containsAscii(bytes, part))
    return found.length === 1 ? found[0][1] : null
  }
  return null
}
