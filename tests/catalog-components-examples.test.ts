import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { allCatalogComponents, findCatalogComponent } from '../catalog/categories.js'
import { formatComponentDetail } from '../catalog/components.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

/**
 * The `aha components <name>` example block must use each markup
 * component's natural wrapper (ol for steps, ul for checklist, ...) so
 * agents copy valid HTML, and every printed example must build unchanged.
 */

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

const hasExample = Predicate.hasProperty('example')

function printedExample(name: string): string {
  const raw = formatComponentDetail(name, true)

  if (raw === null) {
    return ''
  }

  const parsed: unknown = JSON.parse(raw)

  if (!hasExample(parsed)) {
    return ''
  }

  if (!Predicate.isString(parsed.example)) {
    return ''
  }

  return parsed.example
}

const EXPECTED_MARKUP_TAGS: ReadonlyArray<readonly [string, string]> = [
  ['callout', 'aside'],
  ['steps', 'ol'],
  ['checklist', 'ul'],
  ['definition-list', 'dl'],
  ['tabs', 'div'],
  ['scenarios', 'div'],
  ['faq', 'div'],
  ['quote', 'figure']
]

describe('component example wrappers', () => {
  it('prints each markup example in its declared natural wrapper', () => {
    for (const [name, tag] of EXPECTED_MARKUP_TAGS) {
      const component = findCatalogComponent(name)

      expect(component).not.toBe(null)

      if (component !== null) {
        expect(component.markupTag).toBe(tag)
      }

      const example = printedExample(name)

      expect(example.startsWith(`<${tag} data-aha="${name}"`)).toBe(true)

      if (name === 'callout') {
        expect(example).toContain('data-kind=')
      } else {
        expect(example).not.toContain('data-kind=')
      }
    }
  })

  it('emits data-kind only for the callout example', () => {
    for (const component of allCatalogComponents()) {
      if (component.inputKind !== 'markup') {
        continue
      }

      const example = printedExample(component.name)

      expect(example.length).toBeGreaterThan(0)

      if (component.name !== 'callout') {
        expect(example).not.toContain('data-kind=')
      }
    }
  })

  it.effect('builds every printed example unchanged', () =>
    Effect.gen(function* () {
      for (const component of allCatalogComponents()) {
        const example = printedExample(component.name)

        expect(example.length).toBeGreaterThan(0)

        const html = yield* buildPage(authorPage(example)).pipe(Effect.provide(stubBundles))

        expect(html).toContain(component.name)

        const rebuilt = yield* buildPage(html).pipe(Effect.provide(stubBundles))

        expect(rebuilt).toBe(html)
      }
    })
  )
})
