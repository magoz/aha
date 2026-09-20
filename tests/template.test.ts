import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MAX_HTML_BYTES } from '../lib/html-limits.js'

const template = readFileSync(resolve(import.meta.dirname, '../templates/plan.html'), 'utf8')

describe('templates/plan.html', () => {
  it('is a self-contained document the service can serve under its CSP', () => {
    expect(Buffer.byteLength(template)).toBeLessThan(MAX_HTML_BYTES)
    expect(template).not.toMatch(/<(script|form|iframe|link|object|embed|img)\b/i)
    expect(template).not.toMatch(/\bsrc\s*=/i)
    expect(template).not.toMatch(/url\(\s*['"]?https?:/i)
    expect(template).not.toMatch(/@import/i)
    expect(template.match(/<h1\b/g)).toHaveLength(1)
  })

  it('carries the agreed document style tokens', () => {
    expect(template).toMatch(/--accent:\s*#3f6b4a/)
    expect(template).toMatch(/--warn:\s*#b3261e/)
    expect(template).toMatch(/--paper:\s*#f6f1e8/)
    expect(template).toMatch(/prefers-color-scheme:\s*dark/)
    expect(template).toMatch(/@media print/)
    expect(template).not.toMatch(/gradient|box-shadow|backdrop-filter/)
  })
})
