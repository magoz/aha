import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import {
  decodeBasicEntities,
  deriveDocumentName,
  htmlTitle,
  slugifyDocumentName
} from '../cli/document-name.js'
import { isNewDocumentName } from '../lib/plan-id.js'

function page(title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><p>synthetic</p></body></html>`
}

describe('cli document names', () => {
  it('decodes basic entities and reads the page title', () => {
    expect(decodeBasicEntities('R&amp;D &lt;b&gt; &quot;x&quot; &#39;y&#39; &#x41;')).toBe(
      'R&D <b> "x" \'y\' A'
    )
    expect(decodeBasicEntities('&unknown; &#0;')).toBe('&unknown; &#0;')
    expect(htmlTitle(page('  Q3\n  Launch   Plan '))).toBe('Q3 Launch Plan')
    expect(htmlTitle('<TITLE lang="en">Upper</TITLE>')).toBe('Upper')
    expect(htmlTitle('<p>no title</p>')).toBe(null)
  })

  it('slugifies to the new-name rule and truncates at a dash boundary', () => {
    expect(slugifyDocumentName('Q3 Launch Plan: v2.0 (draft)')).toBe('q3-launch-plan-v20-draft')
    expect(slugifyDocumentName('../../etc/passwd')).toBe('etcpasswd')
    expect(slugifyDocumentName('  --a -- b--  ')).toBe('a-b')

    const words = Array.from({ length: 20 }, (_, index) => `word${String(index)}`).join(' ')
    const truncated = slugifyDocumentName(words)

    expect(truncated.length <= 80).toBe(true)
    expect(truncated.endsWith('-')).toBe(false)
    expect(words.replace(/ /g, '-').startsWith(`${truncated}-`)).toBe(true)
    expect(isNewDocumentName(truncated)).toBe(true)

    const unbroken = 'x'.repeat(100)

    expect(slugifyDocumentName(unbroken)).toBe('x'.repeat(80))

    const exact = `${'a'.repeat(80)}-tail`

    expect(slugifyDocumentName(exact)).toBe('a'.repeat(80))
  })

  it.effect('prefers --name over the title', () =>
    Effect.gen(function* () {
      const name = yield* deriveDocumentName('My Custom Name', page('Ignored Title'))

      expect(name).toBe('my-custom-name')
    })
  )

  it.effect('derives the name from the title with entities decoded', () =>
    Effect.gen(function* () {
      const name = yield* deriveDocumentName(null, page('R&amp;D &lt;Roadmap&gt; &#39;25'))

      expect(name).toBe('randd-lessroadmapgreater-25')
    })
  )

  it.effect('truncates long titles to 80 characters', () =>
    Effect.gen(function* () {
      const title =
        'A very long planning document title that keeps going and going well past the limit'

      const name = yield* deriveDocumentName(null, page(title))

      expect(name.length <= 80).toBe(true)
      expect(isNewDocumentName(name)).toBe(true)
      expect(name).toBe(
        'a-very-long-planning-document-title-that-keeps-going-and-going-well-past-the'
      )
    })
  )

  it.effect('fails with a usage error when no usable name can be derived', () =>
    Effect.gen(function* () {
      const inputs: ReadonlyArray<readonly [string | null, string]> = [
        [null, page('')],
        [null, page('   ')],
        [null, page('\u65e5\u672c\u8a9e')],
        [null, '<p>no title at all</p>'],
        ['...', page('Fine Title')],
        [null, page('API')],
        ['api', page('Fine Title')]
      ]

      for (const [explicit, html] of inputs) {
        const failure = yield* Effect.flip(deriveDocumentName(explicit, html))

        expect(Predicate.isTagged(failure, 'CliUsageError')).toBe(true)
        expect(failure.message.includes('--name')).toBe(true)
      }
    })
  )
})
