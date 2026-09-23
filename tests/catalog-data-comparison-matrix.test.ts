import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { comparisonMatrixComponent } from '../catalog/data/comparison-matrix.js'
import { COMPARISON_MATRIX_CSS } from '../catalog/data/comparison-matrix-css.js'
import { renderComparisonMatrix } from '../catalog/data/comparison-matrix-render.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const VALID_JSON = `{
  "title": "Where to run the nightly eval",
  "options": [{ "name": "laptop" }, { "name": "box", "recommended": true }],
  "rows": [
    { "criterion": "gpu for rerank", "cells": [{ "mark": "no" }, { "mark": "yes" }] },
    { "criterion": "cost per run", "cells": [{ "value": 0, "unit": "USD" }, { "value": 0.04, "unit": "USD" }] },
    { "criterion": "caveat", "cells": [{ "text": "sleeps mid-run" }, { "text": "needs wakeTimers" }] }
  ]
}`

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function matrixFigure(json: string): string {
  return `<figure data-aha="comparison-matrix">\n<script type="application/json">${json}</script>\n</figure>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('comparison-matrix', () => {
  it.effect('renders typed cells with a recommended column', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(matrixFigure(VALID_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('gpu for rerank')
      expect(html).toContain('✓')
      expect(html).toContain('sleeps mid-run')
      expect(html).toContain('0.04')
      expect(html).toContain('class="rec"')
      expect(html).toContain('sticky')
    })
  )

  it.effect('rejects rows whose cells do not match the options', () =>
    Effect.gen(function* () {
      const bad = `{"options": [{"name": "a"}], "rows": [{"criterion": "x", "cells": []}]}`

      const failure = yield* buildPage(authorPage(matrixFigure(bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('comparison-matrix')
        expect(failure.path).toContain('cells')
      }
    })
  )

  it.effect('rejects an empty option list', () =>
    Effect.gen(function* () {
      const bad = `{"options": [], "rows": []}`

      const failure = yield* buildPage(authorPage(matrixFigure(bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)
    })
  )

  it.effect('rebuilds idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(matrixFigure(VALID_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it('keeps the title outside the bordered wrapper with an overflow cue', () => {
    const input = JSON.parse(VALID_JSON)
    const html = renderComparisonMatrix(input, { idPrefix: 'qa' })
    const titleAt = html.indexOf('<p class="aha-title">')
    const wrapAt = html.indexOf('<div class="tw">')

    expect(titleAt).toBeGreaterThanOrEqual(0)
    expect(wrapAt).toBeGreaterThan(titleAt)
    expect(html).toContain('<div class="edge" aria-hidden="true"></div>')
  })

  it('groups thousands in number cells without losing decimals', () => {
    const input = JSON.parse(
      '{"options": [{"name": "a"}, {"name": "b"}], "rows": [' +
        '{"criterion": "price", "cells": [{"value": 59990, "unit": "SEK"}, {"value": 0.04, "unit": "USD"}]}]}'
    )

    const html = renderComparisonMatrix(input, { idPrefix: 'qa' })

    expect(html).toContain('59,990')
    expect(html).toContain('0.04')
  })

  it('wraps columns with max widths and a paper fade cue instead of a shadow', () => {
    expect(COMPARISON_MATRIX_CSS).toContain('.edge')
    expect(COMPARISON_MATRIX_CSS).toContain('linear-gradient')
    expect(COMPARISON_MATRIX_CSS).toContain('--paper')
    expect(COMPARISON_MATRIX_CSS).toContain('overflow-wrap: break-word')
    expect(COMPARISON_MATRIX_CSS).toContain('max-width')
    expect(COMPARISON_MATRIX_CSS).not.toContain('box-shadow')
    expect(COMPARISON_MATRIX_CSS).toContain('position: sticky')
  })

  it.effect('builds a six-option matrix with large prices idempotently', () =>
    Effect.gen(function* () {
      const json =
        '{"title": "Host price per night", "options": [' +
        '{"name": "cabin"}, {"name": "lodge"}, {"name": "hotel"}, ' +
        '{"name": "hostel"}, {"name": "boat", "recommended": true}, {"name": "tent"}], ' +
        '"rows": [' +
        '{"criterion": "july price", "cells": [{"value": 12990, "unit": "SEK"}, {"value": 24990, "unit": "SEK"}, {"value": 59990, "unit": "SEK"}, {"value": 8990, "unit": "SEK"}, {"value": 34990, "unit": "SEK"}, {"value": 1990, "unit": "SEK"}]}, ' +
        '{"criterion": "sauna", "cells": [{"mark": "yes"}, {"mark": "yes"}, {"mark": "partial"}, {"mark": "no"}, {"mark": "no"}, {"mark": "no"}]}, ' +
        '{"criterion": "caveat", "cells": [{"text": "no running water"}, {"text": "shared kitchen"}, {"text": "conference rates"}, {"text": "curfew at midnight"}, {"text": "weather dependent"}, {"text": "bring everything"}]}]}'

      const source = authorPage(matrixFigure(json))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))

      expect(first).toContain('59,990')
      expect(first).toContain('12,990')

      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('comparison-matrix', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('options')
      expect(detail).toContain('criterion')
      expect(detail).toContain('recommended')
      expect(detail).toContain('<figure data-aha="comparison-matrix">')
    }

    expect(comparisonMatrixComponent.examples.length).toBeGreaterThan(0)
  })
})
