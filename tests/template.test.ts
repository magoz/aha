import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_HTML_BYTES } from '../lib/html-limits.js'

const templates = ['note', 'plan'].map((name) => ({
  name,
  html: readFileSync(resolve(import.meta.dirname, `../templates/${name}.html`), 'utf8')
}))

describe.each(templates)('templates/$name.html', ({ html }) => {
  it('is a self-contained document the service can serve under its CSP', () => {
    expect(Buffer.byteLength(html)).toBeLessThan(MAX_HTML_BYTES)
    expect(html).not.toMatch(/<(script|form|iframe|link|object|embed|img)\b/i)
    expect(html).not.toMatch(/\bsrc\s*=/i)
    expect(html).not.toMatch(/url\(/i)
    expect(html).not.toMatch(/@import/i)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
  })

  it('carries the agreed document style tokens', () => {
    expect(html).toMatch(/--paper:\s*#faf8f4/)
    expect(html).toMatch(/--ink:\s*#1b1a18/)
    expect(html).toMatch(/--accent:\s*#3f6b4a/)
    expect(html).toMatch(/--warn:\s*#b3261e/)
    expect(html).toMatch(/--mono:\s*ui-monospace/)
    expect(html).toMatch(/prefers-color-scheme:\s*dark/)
    expect(html).toMatch(/@media print/)
    expect(html).not.toMatch(/gradient|box-shadow|backdrop-filter|border-radius:\s*[1-9]/)
    expect(html).not.toMatch(/Georgia|Palatino|Times New Roman/)
  })
})

describe('template kinds', () => {
  it('keeps the short note free of a contents list', () => {
    const note = templates[0]?.html ?? ''
    expect(note).not.toMatch(/class="toc"/)
  })

  it('gives the long document a numbered contents list and no metadata block', () => {
    const plan = templates[1]?.html ?? ''
    expect(plan).toMatch(/class="toc"/)
    expect(plan).not.toMatch(/class="meta"/)
  })

  it('leaves section headings unnumbered', () => {
    for (const { html } of templates) {
      expect(html).not.toMatch(/<h2[^>]*>\s*<span class="n">/)
    }
  })
})
