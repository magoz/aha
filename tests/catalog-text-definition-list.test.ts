import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { definitionListComponent } from '../catalog/text/definition-list.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const VALID_MARKUP = [
  '<dt id="temperature">temperature</dt>',
  '<dd><p>Sampling randomness per token.</p></dd>',
  '<dt>top-p</dt>',
  '<dd><p>Nucleus cutoff over probability mass p.</p></dd>'
].join('\n')

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function defList(markup: string): string {
  return `<dl data-aha="definition-list">\n${markup}\n</dl>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('definition-list', () => {
  it.effect('anchors every term and keeps author ids', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(defList(VALID_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('id="temperature"')
      expect(html).toContain('href="#temperature"')
      expect(html).toContain('id="top-p"')
      expect(html).toContain('href="#top-p"')
      expect(html).toContain('Sampling randomness')
    })
  )

  it.effect('rejects a list without terms', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(authorPage(defList('<dd><p>orphan</p></dd>'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('definition-list')
      }
    })
  )

  it.effect('rebuilds idempotently without doubling anchors', () =>
    Effect.gen(function* () {
      const source = authorPage(defList(VALID_MARKUP))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first.split('<a class="dl-anchor"').length).toBe(3)
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('definition-list', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('children')
      expect(detail).toContain('dt')
    }

    expect(definitionListComponent.examples.length).toBeGreaterThan(0)
  })
})
