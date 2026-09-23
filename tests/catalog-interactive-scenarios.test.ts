import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { scenariosComponent } from '../catalog/interactive/scenarios.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const CHART_JSON = `{"title": "Balance", "x": {"kind": "category"}, "series": [{"name": "balance", "values": [{"x": "yr 0", "y": 3}, {"x": "yr 1", "y": 0}]}]}`

const VALID_MARKUP = [
  '<section data-scenario="3%">',
  '<p>At 3% the loan clears early.</p>',
  `<figure data-aha="line-chart">\n<script type="application/json">${CHART_JSON}</script>\n</figure>`,
  '</section>',
  '<section data-scenario="5%">',
  '<p>At 5% the loan costs more.</p>',
  `<figure data-aha="line-chart">\n<script type="application/json">${CHART_JSON}</script>\n</figure>`,
  '</section>'
].join('\n')

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function scenariosBlock(markup: string): string {
  return `<div data-aha="scenarios">\n${markup}\n</div>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('scenarios', () => {
  it.effect('builds nested charts inside scenarios exactly once', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(scenariosBlock(VALID_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('data-scenario="3%"')
      expect(html).toContain('data-scenario="5%"')
      expect(html).toContain('clears early')
      expect(html).toContain('costs more')

      const chartMarks = html.split('<!--aha:render:line-chart-->').length - 1

      expect(chartMarks).toBe(2)
      expect(html).toContain('aha-line-chart')
    })
  )

  it.effect('inlines nested chart css and bundles', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(scenariosBlock(VALID_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('/* bundle:scenarios.client.js */')
      expect(html).toContain('/* bundle:line-chart.client.js */')
      expect(html).toContain('.aha-line-chart')
      expect(html).toContain('.aha-scenarios')
    })
  )

  it.effect('rebuilds nested output idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(scenariosBlock(VALID_MARKUP))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it.effect('rejects blocks without labeled scenarios', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(authorPage(scenariosBlock('<p>No scenarios.</p>'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('scenarios')
      }
    })
  )

  it('ships a nested example', () => {
    expect(scenariosComponent.examples.length).toBeGreaterThan(0)
    expect(scenariosComponent.examples[0]?.markup).toContain('data-aha="line-chart"')
  })
})
