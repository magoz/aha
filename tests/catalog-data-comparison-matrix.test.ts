import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { comparisonMatrixComponent } from '../catalog/data/comparison-matrix.js'
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
