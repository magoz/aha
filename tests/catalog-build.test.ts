import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate, Schema } from 'effect'

import { buildPage } from '../catalog/build.js'
import { findBlocks } from '../catalog/blocks.js'
import {
  allCatalogComponents,
  catalogCategories,
  findCatalogComponent
} from '../catalog/categories.js'
import { formatComponentDetail, formatComponentsList } from '../catalog/components.js'
import { lineChartComponent } from '../catalog/charts/line-chart.js'
import { LINE_CHART_WIDTH, renderLineChart } from '../catalog/charts/line-chart-render.js'
import { LineChartSchema } from '../catalog/charts/line-chart-schema.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const LINE_JSON = `{
  "x": { "kind": "category" },
  "series": [
    { "name": "Alpha", "values": [{ "x": "a", "y": 1 }, { "x": "b", "y": 2 }] },
    { "name": "Beta", "values": [{ "x": "a", "y": 2 }, { "x": "b", "y": 1 }] }
  ]
}`

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n<p>prologue</p>\n${body}\n<p>epilogue</p>\n</body></html>`
}

function lineFigure(json: string): string {
  return `<figure data-aha="line-chart">\n<script type="application/json">${json}</script>\n<figcaption>Cap.</figcaption>\n</figure>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('catalog build', () => {
  it.effect('renders a valid block and preserves surrounding bytes', () =>
    Effect.gen(function* () {
      const source = authorPage(lineFigure(LINE_JSON))
      const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

      expect(html).toContain('<p>prologue</p>')
      expect(html).toContain('<p>epilogue</p>')
      expect(html).toContain('<!--aha:render:line-chart-->')
      expect(html).toContain('Alpha')
      expect(html).toContain('figcaption')
      expect(html).toContain(LINE_JSON)
    })
  )

  it.effect('names the block, component and field path on decode errors', () =>
    Effect.gen(function* () {
      const bad = `{"x": {"kind": "category"}, "series": [{"name": "A", "values": [{"x": "a", "y": "high"}]}]}`

      const failure = yield* buildPage(authorPage(lineFigure(bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.blockIndex).toBe(0)
        expect(failure.component).toBe('line-chart')
        expect(failure.path).toContain('series')
        expect(failure.path).toContain('y')
        expect(failure.message).toContain('block 0 (line-chart)')
      }
    })
  )

  it.effect('rejects unknown components', () =>
    Effect.gen(function* () {
      const source = authorPage(
        '<figure data-aha="nope"><script type="application/json">{}</script></figure>'
      )

      const failure = yield* buildPage(source).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(failure, 'UnknownComponentError')).toBe(true)
    })
  )

  it.effect('renders deterministically and idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(lineFigure(LINE_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const second = yield* buildPage(source).pipe(Effect.provide(stubBundles))

      expect(second).toBe(first)

      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it.effect('inlines only the used components', () =>
    Effect.gen(function* () {
      const source = authorPage(lineFigure(LINE_JSON))
      const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

      expect(html).toContain('/* bundle:line-chart.client.js */')
      expect(html).toContain('.aha-line-chart')
      expect(html).not.toContain('data-table.client.js')
      expect(html).not.toContain('.aha-table')
      expect(html).not.toContain('.callout')
    })
  )

  it.effect('leaves pages without blocks alone', () =>
    Effect.gen(function* () {
      const source = authorPage('<p>just prose</p>')
      const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

      expect(html).toBe(source)
    })
  )

  it.effect('renders the same static markup for the same input', () =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeUnknownEffect(LineChartSchema)(JSON.parse(LINE_JSON))

      const left = renderLineChart(decoded, {
        width: LINE_CHART_WIDTH,
        idPrefix: 'aha-0-line-chart'
      })

      const right = renderLineChart(decoded, {
        width: LINE_CHART_WIDTH,
        idPrefix: 'aha-0-line-chart'
      })

      expect(right).toBe(left)
      expect(findBlocks(authorPage(lineFigure(LINE_JSON))).length).toBe(1)
    })
  )
})

describe('catalog registry', () => {
  it('aggregates every category with unique component names', () => {
    const names: Array<string> = []

    for (const component of allCatalogComponents()) {
      names.push(component.name)
    }

    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('line-chart')
    expect(names).toContain('time-strips')
    expect(names).toContain('data-table')
    expect(names).toContain('callout')

    let covered = 0

    for (const category of catalogCategories) {
      covered += category.components.length

      for (const component of category.components) {
        expect(findCatalogComponent(component.name)).toBe(component)
      }
    }

    expect(covered).toBe(names.length)
    expect(lineChartComponent.examples.length).toBeGreaterThan(0)
  })

  it('lists components and details with fields plus a paste-ready example', () => {
    const list = formatComponentsList(false)

    expect(list).toContain('line-chart')
    expect(list).toContain('data-table')

    const detail = formatComponentDetail('line-chart', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('series')
      expect(detail).toContain('<figure data-aha="line-chart">')
    }

    expect(formatComponentDetail('missing', false)).toBe(null)
    expect(formatComponentsList(true)).toContain('"callout"')
  })
})
