import { expect, test } from 'vitest'
import { cleanFilename, MEDIA_TYPES, mediaTypeForFilename, sniffMediaType } from '../src/attachments/rules.js'

// Synthetic file headers only. None of these are real documents.
const pdf = Buffer.from('%PDF-1.7\n% Synthetic handout for tests\n%%EOF\n')
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])
const zipWith = (...entries: string[]) => Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  ...entries.map((entry) => Buffer.from(`synthetic-entry ${entry} `, 'latin1')),
])

test('allows only the agreed extensions, case-insensitively', () => {
  expect(mediaTypeForFilename('handout.PDF')).toBe(MEDIA_TYPES.pdf)
  expect(mediaTypeForFilename('chart.jpg')).toBe(MEDIA_TYPES.jpeg)
  expect(mediaTypeForFilename('chart.jpeg')).toBe(MEDIA_TYPES.jpeg)
  expect(mediaTypeForFilename('labs.xlsx')).toBe(MEDIA_TYPES.xlsx)
  for (const name of ['page.html', 'script.exe', 'macro.docm', 'image.svg', 'noextension', 'archive.zip', 'pdf']) {
    expect(mediaTypeForFilename(name)).toBeNull()
  }
})

test('identifies a file by its bytes, not its name', () => {
  expect(sniffMediaType(pdf)).toBe(MEDIA_TYPES.pdf)
  expect(sniffMediaType(png)).toBe(MEDIA_TYPES.png)
  expect(sniffMediaType(jpeg)).toBe(MEDIA_TYPES.jpeg)
  expect(sniffMediaType(zipWith('[Content_Types].xml', 'word/document.xml'))).toBe(MEDIA_TYPES.docx)
  expect(sniffMediaType(zipWith('ppt/presentation.xml'))).toBe(MEDIA_TYPES.pptx)
  expect(sniffMediaType(zipWith('xl/workbook.xml'))).toBe(MEDIA_TYPES.xlsx)
})

test('refuses unknown content, plain ZIPs, ambiguous ZIPs and macro-enabled Office files', () => {
  expect(sniffMediaType(Buffer.from('<html><script>synthetic</script></html>'))).toBeNull()
  expect(sniffMediaType(Buffer.from('MZ synthetic executable header'))).toBeNull()
  expect(sniffMediaType(Buffer.alloc(0))).toBeNull()
  expect(sniffMediaType(zipWith('notes.txt'))).toBeNull()
  expect(sniffMediaType(zipWith('word/document.xml', 'xl/workbook.xml'))).toBeNull()
  expect(sniffMediaType(zipWith('word/document.xml', 'word/vbaProject.bin'))).toBeNull()
})

test('cleans display names without trusting paths or control characters', () => {
  expect(cleanFilename('  Synthetic chart.pdf  ')).toBe('Synthetic chart.pdf')
  expect(cleanFilename('C:\\Users\\someone\\labs.pdf')).toBe('labs.pdf')
  expect(cleanFilename('../../etc/passwd.pdf')).toBe('passwd.pdf')
  expect(cleanFilename('evil\u202Efdp.exe')).toBe('evilfdp.exe')
  expect(cleanFilename('quote"name.pdf')).toBe('quotename.pdf')
  expect(cleanFilename('line\nbreak.pdf')).toBe('linebreak.pdf')
  for (const name of ['', '   ', '/', '..', 'folder/']) expect(cleanFilename(name)).toBeNull()
  const long = cleanFilename('a'.repeat(400) + '.docx')
  expect(long).toHaveLength(255)
  expect(long?.endsWith('.docx')).toBe(true)
})
