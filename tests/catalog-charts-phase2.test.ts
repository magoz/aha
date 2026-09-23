import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { findCatalogComponent } from '../catalog/categories.js'
import { formatComponentDetail } from '../catalog/components.js'
import { chartsComponents } from '../catalog/charts/registry.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const NEW_COMPONENTS = [
  'bar-chart',
  'area-chart',
  'scatter-plot',
  'sparkline',
  'heatmap',
  'range-plot',
  'proportion-bar',
  'histogram'
]

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

function blockFor(name: string, json: string): string {
  const tag = name === 'sparkline' ? 'div' : 'figure'

  return `<${tag} data-aha="${name}">\n<script type="application/json">${json}</script>\n</${tag}>`
}

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

describe('phase-2 charts registry', () => {
  it('registers every new chart with examples, fields and a client bundle', () => {
    for (const name of NEW_COMPONENTS) {
      const component = findCatalogComponent(name)

      expect(component).not.toBe(null)

      if (component === null) {
        continue
      }

      expect(component.category).toBe('charts')
      expect(component.examples.length).toBeGreaterThan(0)
      expect(component.fields.length).toBeGreaterThan(0)
      expect(component.clientBundle).toBe(`${name}.client.js`)
      expect(chartsComponents).toContain(component)

      for (const example of component.examples) {
        expect(example.json).not.toBe(null)
      }
    }
  })

  it('documents fields well enough to teach an agent', () => {
    for (const name of NEW_COMPONENTS) {
      const detail = formatComponentDetail(name, false)

      expect(detail).not.toBe(null)

      if (detail !== null) {
        expect(detail).toContain(`data-aha="${name}"`)
      }
    }
  })
})

describe('phase-2 charts build', () => {
  it.effect('renders every example and rebuilds idempotently', () =>
    Effect.gen(function* () {
      for (const name of NEW_COMPONENTS) {
        const component = findCatalogComponent(name)

        expect(component).not.toBe(null)

        if (component === null) {
          continue
        }

        for (const example of component.examples) {
          if (example.json === null) {
            continue
          }

          const source = authorPage(blockFor(name, example.json))
          const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

          expect(html).toContain(`<!--aha:render:${name}-->`)
          expect(html).toContain(`/* bundle:${name}.client.js */`)
          expect(html).toContain(example.json)

          const rebuilt = yield* buildPage(html).pipe(Effect.provide(stubBundles))

          expect(rebuilt).toBe(html)
        }
      }
    })
  )

  it.effect('rejects a bar series whose values miss the category count', () =>
    Effect.gen(function* () {
      const bad = `{"categories": ["a", "b"], "series": [{"name": "S", "values": [1]}]}`

      const failure = yield* buildPage(authorPage(blockFor('bar-chart', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('bar-chart')
        expect(failure.path).toContain('values')
      }
    })
  )

  it.effect('rejects a ragged heatmap matrix', () =>
    Effect.gen(function* () {
      const bad = `{"rows": ["a", "b"], "columns": ["x"], "values": [[1], [2, 3]]}`

      const failure = yield* buildPage(authorPage(blockFor('heatmap', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('heatmap')
        expect(failure.path).toContain('values')
      }
    })
  )

  it.effect('rejects an all-zero proportion bar', () =>
    Effect.gen(function* () {
      const bad = `{"bars": [{"parts": [{"name": "a", "value": 0}]}]}`

      const failure = yield* buildPage(authorPage(blockFor('proportion-bar', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('proportion-bar')
      }
    })
  )

  it.effect('rejects empty data for the single-series charts', () =>
    Effect.gen(function* () {
      const cases: ReadonlyArray<{ name: string; json: string; path: string }> = [
        { name: 'area-chart', json: '{"x": {"kind": "number"}, "series": []}', path: 'series' },
        { name: 'scatter-plot', json: '{"points": []}', path: 'points' },
        { name: 'sparkline', json: '{"values": []}', path: 'values' },
        { name: 'range-plot', json: '{"rows": []}', path: 'rows' },
        { name: 'histogram', json: '{"values": []}', path: 'values' }
      ]

      for (const single of cases) {
        const failure = yield* buildPage(authorPage(blockFor(single.name, single.json))).pipe(
          Effect.provide(stubBundles),
          Effect.flip
        )

        expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

        if (Predicate.isTagged(failure, 'BlockDecodeError')) {
          expect(failure.component).toBe(single.name)
          expect(failure.path).toContain(single.path)
        }
      }
    })
  )
})
