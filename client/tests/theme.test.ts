// Issue #38: checks the color rules in the stylesheets that a reviewer can't
// easily see by eye. Every color is a token on :root, both themes define the
// same tokens, and the text/border pairs meet WCAG 2.1 AA in each theme.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const srcDir = new URL('../src/', import.meta.url)
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const indexCss = stripComments(readFileSync(new URL('index.css', srcDir), 'utf8'))

// The light tokens are the first top-level :root block; the dark ones are the
// :root block inside the prefers-color-scheme: dark media query.
const darkMatch = indexCss.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/)
const lightMatch = indexCss.match(/^:root\s*\{([^}]*)\}/m)
assert.ok(lightMatch, 'index.css has a top-level :root block')
assert.ok(darkMatch, 'index.css has a dark-mode :root block')

function colorTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>()
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(name, value.toLowerCase())
  }
  return tokens
}

const themes = { light: colorTokens(lightMatch[1]), dark: colorTokens(darkMatch[1]) }

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [foreground, background, minimum ratio]. Keep in step with the list at the
// top of index.css. --border is decorative and deliberately not here.
const pairs: Array<[string, string, number]> = []
for (const fg of ['--text', '--text-h', '--text-muted', '--link', '--danger']) {
  for (const bg of ['--bg', '--surface', '--surface-alt']) pairs.push([fg, bg, 4.5])
}
pairs.push(['--on-accent', '--accent', 4.5], ['--on-accent', '--accent-hover', 4.5])
for (const fg of ['--border-strong', '--focus', '--danger', '--accent']) {
  for (const bg of ['--bg', '--surface', '--surface-alt']) pairs.push([fg, bg, 3])
}

test('light and dark themes define the same color tokens', () => {
  assert.deepEqual([...themes.dark.keys()].sort(), [...themes.light.keys()].sort())
})

for (const [name, tokens] of Object.entries(themes)) {
  test(`${name} theme meets WCAG 2.1 AA contrast`, () => {
    const failures: string[] = []
    for (const [fg, bg, min] of pairs) {
      const a = tokens.get(fg)
      const b = tokens.get(bg)
      assert.ok(a && b, `${name} theme defines ${fg} and ${bg}`)
      const ratio = contrast(a, b)
      if (ratio < min) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)} (needs ${min})`)
    }
    assert.deepEqual(failures, [])
  })
}

test('no color values outside the :root tokens', () => {
  const colorValue = /:[^;{}]*(#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\()/
  const offenders: string[] = []
  const cssFiles = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.css'))
  assert.ok(cssFiles.includes('index.css'))
  for (const file of cssFiles) {
    let css = stripComments(readFileSync(new URL(file, srcDir), 'utf8'))
    if (file === 'index.css') {
      css = css.replace(lightMatch[0], '').replace(darkMatch[0], '')
    }
    for (const line of css.split('\n')) {
      if (colorValue.test(line)) offenders.push(`${file}: ${line.trim()}`)
    }
  }
  assert.deepEqual(offenders, [])
})
