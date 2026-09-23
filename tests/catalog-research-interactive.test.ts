import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { faqComponent } from '../catalog/research/faq.js'
import { riskMatrixComponent } from '../catalog/research/risk-matrix.js'
import { levelScore } from '../catalog/research/risk-matrix-render.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function jsonFigure(name: string, json: string): string {
  return `<figure data-aha="${name}">\n<script type="application/json">${json}</script>\n</figure>`
}

function faqBlock(markup: string): string {
  return `<div data-aha="faq">\n${markup}\n</div>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

const RISKS_JSON = `{
  "title": "Nightly eval risks",
  "risks": [
    {
      "title": "The gateway hostname loops back",
      "likelihood": 2,
      "impact": 5,
      "mitigation": "Forward only to the fixed alias.",
      "owner": "on-call"
    },
    {
      "title": "The box sleeps through the run",
      "likelihood": "med",
      "impact": "high",
      "mitigation": "Wake timers plus a heartbeat alert."
    }
  ]
}`

const FAQ_MARKUP = [
  '<details>',
  '<summary>Why the box?</summary>',
  '<p>It reads privately in the window.</p>',
  '</details>',
  '<details>',
  '<summary>What if it sleeps?</summary>',
  '<p>Wake timers bring it up.</p>',
  '</details>'
].join('\n')

describe('risk-matrix level scores', () => {
  it('maps words to the documented numbers', () => {
    expect(levelScore('low')).toBe(1)
    expect(levelScore('med')).toBe(3)
    expect(levelScore('medium')).toBe(3)
    expect(levelScore('high')).toBe(5)
    expect(levelScore(4)).toBe(4)
    expect(levelScore(0)).toBe(null)
    expect(levelScore(6)).toBe(null)
  })
})

describe('risk-matrix', () => {
  it.effect('plots numbered markers and lists mitigations with owners', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('risk-matrix', RISKS_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('data-mk="0"')
      expect(html).toContain('data-row="1"')
      expect(html).toContain('The gateway hostname loops back')
      expect(html).toContain('likelihood 2 · impact 5')
      expect(html).toContain('likelihood 3 · impact 5')
      expect(html).toContain('Forward only to the fixed alias.')
      expect(html).toContain('on-call')
      expect(html).toContain('/* bundle:risk-matrix.client.js */')
    })
  )

  it.effect('rejects an out-of-range level', () =>
    Effect.gen(function* () {
      const bad = `{"risks": [{"title": "R.", "likelihood": 6, "impact": 2}]}`

      const failure = yield* buildPage(authorPage(jsonFigure('risk-matrix', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('risk-matrix')
        expect(failure.path).toBe('risks[0].likelihood')
      }
    })
  )

  it.effect('rebuilds idempotently and inlines only its bundle', () =>
    Effect.gen(function* () {
      const source = authorPage(jsonFigure('risk-matrix', RISKS_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).not.toContain('bundle:faq.client.js')
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('risk-matrix', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('likelihood')
      expect(detail).toContain('mitigation')
    }

    expect(riskMatrixComponent.examples.length).toBeGreaterThan(0)
    expect(riskMatrixComponent.clientBundle).toBe('risk-matrix.client.js')
  })
})

describe('faq', () => {
  it.effect('keeps native disclosures with no generated control', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(faqBlock(FAQ_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('<details>')
      expect(html).toContain('<summary>Why the box?</summary>')
      expect(html).toContain('It reads privately in the window.')
      expect(html).toContain('What if it sleeps?')
      expect(html).not.toContain('<div class="faq-ctl"')
      expect(html).toContain('/* bundle:faq.client.js */')
    })
  )

  it.effect('rejects blocks without disclosures and summaries', () =>
    Effect.gen(function* () {
      const empty = yield* buildPage(authorPage(faqBlock('<p>No questions.</p>'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(empty, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(empty, 'BlockDecodeError')) {
        expect(empty.component).toBe('faq')
        expect(empty.path).toBe('children')
      }

      const noSummary = yield* buildPage(
        authorPage(faqBlock('<details><p>Missing the question.</p></details>'))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(noSummary, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(noSummary, 'BlockDecodeError')) {
        expect(noSummary.message).toContain('summary')
      }
    })
  )

  it.effect('rebuilds idempotently and inlines only its bundle', () =>
    Effect.gen(function* () {
      const source = authorPage(faqBlock(FAQ_MARKUP))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).not.toContain('bundle:risk-matrix.client.js')
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('faq', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('details')
    }

    expect(faqComponent.examples.length).toBeGreaterThan(0)
    expect(faqComponent.clientBundle).toBe('faq.client.js')
  })
})
