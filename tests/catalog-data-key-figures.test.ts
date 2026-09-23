import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate, Schema } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { keyFiguresComponent } from '../catalog/data/key-figures.js'
import { renderKeyFigures } from '../catalog/data/key-figures-render.js'
import { KeyFiguresSchema } from '../catalog/data/key-figures-schema.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const VALID_JSON = `{
  "title": "Overnight inference bill",
  "figures": [
    { "label": "tasks", "value": "41,208", "delta": "+3,112 vs Tue", "direction": "up", "trend": [31, 33, 32, 35, 34, 37, 38, 41] },
    { "label": "median latency", "value": "182", "unit": "ms", "delta": "-24 ms vs Tue", "direction": "down", "trend": [240, 228, 231, 214, 205, 198, 190, 182] }
  ]
}`

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function keyFigure(json: string): string {
  return `<figure data-aha="key-figures">\n<script type="application/json">${json}</script>\n</figure>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('key-figures', () => {
  it.effect('renders headline numbers with signed deltas and sparklines', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(keyFigure(VALID_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('41,208')
      expect(html).toContain('+3,112 vs Tue')
      expect(html).toContain('▲')
      expect(html).toContain('▼')
      expect(html).toContain('<svg class="spark"')
      expect(html).toContain('182')
    })
  )

  it.effect('rejects fewer than two figures', () =>
    Effect.gen(function* () {
      const bad = `{"figures": [{"label": "tasks", "value": "1"}]}`

      const failure = yield* buildPage(authorPage(keyFigure(bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('key-figures')
        expect(failure.path).toBe('figures')
      }
    })
  )

  it.effect('names the field path on schema errors', () =>
    Effect.gen(function* () {
      const bad = `{"figures": [{"label": "tasks"}, {"label": "cost", "value": "2"}]}`

      const failure = yield* buildPage(authorPage(keyFigure(bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toContain('figures')
        expect(failure.message).toContain('block 0 (key-figures)')
      }
    })
  )

  it.effect('renders deterministically and rebuilds idempotently', () =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeUnknownEffect(KeyFiguresSchema)(JSON.parse(VALID_JSON))
      const left = renderKeyFigures(decoded, { idPrefix: 'aha-0-key-figures' })
      const right = renderKeyFigures(decoded, { idPrefix: 'aha-0-key-figures' })

      expect(right).toBe(left)

      const source = authorPage(keyFigure(VALID_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).toContain('<!--aha:render:key-figures-->')
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('key-figures', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('figures')
      expect(detail).toContain('delta')
      expect(detail).toContain('trend')
      expect(detail).toContain('<figure data-aha="key-figures">')
    }

    expect(keyFiguresComponent.examples.length).toBeGreaterThan(0)
  })
})
