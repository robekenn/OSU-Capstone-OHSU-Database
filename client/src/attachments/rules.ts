// Attachment limits shown to faculty (#63). The API enforces the real rules
// (server/src/attachments/rules.ts); these only give quick feedback before upload.

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

const TYPES: Record<string, { mediaType: string; label: string }> = {
  pdf: { mediaType: 'application/pdf', label: 'PDF' },
  docx: { mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word' },
  pptx: { mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint' },
  xlsx: { mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
  png: { mediaType: 'image/png', label: 'PNG image' },
  jpg: { mediaType: 'image/jpeg', label: 'JPEG image' },
  jpeg: { mediaType: 'image/jpeg', label: 'JPEG image' },
}

// For the file picker's accept attribute.
export const ACCEPT = Object.keys(TYPES).map((extension) => '.' + extension).join(',')

export const ALLOWED_DESCRIPTION = 'PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), PNG or JPEG, up to 25 MB each.'

export function mediaTypeForFilename(filename: string): string | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(filename)
  return match ? TYPES[match[1].toLowerCase()]?.mediaType ?? null : null
}

// A short name for a stored media type, for the file list.
export function typeLabel(mediaType: string): string {
  return Object.values(TYPES).find((type) => type.mediaType === mediaType)?.label ?? 'File'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// The message to show for a file that would be refused, or null if it may be uploaded.
export function checkFile(file: { name: string; size: number }): string | null {
  if (!mediaTypeForFilename(file.name)) return '"' + file.name + '" is not an allowed file type. Use ' + ALLOWED_DESCRIPTION
  if (file.size === 0) return '"' + file.name + '" is empty.'
  if (file.size > MAX_ATTACHMENT_BYTES) return '"' + file.name + '" is ' + formatBytes(file.size) + '. Files can be at most 25 MB.'
  return null
}
