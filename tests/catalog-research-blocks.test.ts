import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { claimsComponent } from '../catalog/research/claims.js'
import { decisionRecordComponent } from '../catalog/research/decision-record.js'
import { prosConsComponent } from '../catalog/research/pros-cons.js'
import { sourcesComponent } from '../catalog/research/sources.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function jsonFigure(name: string, json: string): string {
  return `<figure data-aha="${name}">\n<script type="application/json">${json}</script>\n</figure>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

const SOURCES_JSON = `{
  "title": "What the eval-host decision rests on",
  "sources": [
    {
      "id": "r2-pricing",
      "title": "R2 pricing: zero egress fees",
      "url": "https://developers.cloudflare.com/r2/pricing/",
      "publisher": "Cloudflare",
      "observed": "2026-09-20",
      "supports": "Egress from R2 is free."
    },
    {
      "title": "Cron job limits",
      "url": "https://vercel.com/docs/cron-jobs",
      "publisher": "Vercel",
      "supports": "Cron invocations time out after a few minutes."
    }
  ]
}`

const CLAIMS_JSON = `{
  "title": "Eval-host findings",
  "claims": [
    { "statement": "R2 egress is free.", "confidence": "high", "sources": ["r2-pricing"] },
    { "statement": "Cron may improve later.", "confidence": "low" }
  ]
}`

const DECISION_JSON = `{
  "title": "Where to run the nightly eval",
  "status": "accepted",
  "date": "2026-09-20",
  "context": "The eval needs private reads and must finish overnight.",
  "options": [
    { "name": "laptop", "summary": "Free but sleeps mid-run." },
    { "name": "tailnet box", "summary": "Always on with private reads." }
  ],
  "decision": { "option": "tailnet box", "why": "Only it reads privately in the window." },
  "consequences": { "positive": ["Private reads keep working."], "negative": ["Someone owns the box."] }
}`

const PROS_CONS_JSON = `{
  "title": "Tailnet box",
  "pros": [{ "text": "Reads privately", "weight": "+2" }],
  "cons": [{ "text": "Needs patching" }],
  "verdict": "Take the box."
}`

describe('sources', () => {
  it.effect('renders a numbered list with anchors and visible urls', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('sources', SOURCES_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('id="src-r2-pricing"')
      expect(html).toContain('[1]')
      expect(html).toContain('[2]')
      expect(html).toContain('https://developers.cloudflare.com/r2/pricing/')
      expect(html).toContain('Cloudflare')
      expect(html).toContain('Egress from R2 is free.')
    })
  )

  it.effect('rejects a non-http url', () =>
    Effect.gen(function* () {
      const bad = `{"sources": [{"title": "T", "url": "ftp://x/y", "publisher": "P", "supports": "S"}]}`

      const failure = yield* buildPage(authorPage(jsonFigure('sources', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('sources')
        expect(failure.path).toBe('sources[0].url')
      }
    })
  )

  it.effect('rejects duplicate ids', () =>
    Effect.gen(function* () {
      const bad = `{"sources": [
        {"title": "A", "url": "https://a/x", "publisher": "P", "supports": "S", "id": "dup"},
        {"title": "B", "url": "https://b/x", "publisher": "P", "supports": "S", "id": "dup"}
      ]}`

      const failure = yield* buildPage(authorPage(jsonFigure('sources', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toBe('sources[1].id')
      }
    })
  )

  it.effect('rebuilds idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(jsonFigure('sources', SOURCES_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).toContain('<!--aha:render:sources-->')
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('sources', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('anchor')
      expect(detail).toContain('Sources in display order')
      expect(detail).toContain('<figure data-aha="sources">')
    }

    expect(sourcesComponent.examples.length).toBeGreaterThan(0)
    expect(sourcesComponent.clientBundle).toBe(null)
  })
})

describe('claims', () => {
  it.effect('renders badges and citation links in first-mention order', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('claims', CLAIMS_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('R2 egress is free.')
      expect(html).toContain('conf-high')
      expect(html).toContain('conf-low')
      expect(html).toContain('●')
      expect(html).toContain('○')
      expect(html).toContain('href="#src-r2-pricing"')
      expect(html).toContain('[1]')
    })
  )

  it.effect('rejects an unknown source id with its path', () =>
    Effect.gen(function* () {
      const bad = `{"claims": [{"statement": "S.", "confidence": "high", "sources": ["no such id"]}]}`

      const failure = yield* buildPage(authorPage(jsonFigure('claims', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('claims')
        expect(failure.path).toBe('claims[0].sources[0]')
        expect(failure.message).toContain('claims')
      }
    })
  )

  it.effect('rebuilds idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(jsonFigure('claims', CLAIMS_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('claims', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('confidence')
      expect(detail).toContain('sources')
    }

    expect(claimsComponent.examples.length).toBeGreaterThan(0)
    expect(claimsComponent.clientBundle).toBe(null)
  })
})

describe('decision-record', () => {
  it.effect('marks the chosen option and signs consequences', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('decision-record', DECISION_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('tailnet box')
      expect(html).toContain('chosen')
      expect(html).toContain('✓')
      expect(html).toContain('accepted')
      expect(html).toContain('Private reads keep working.')
      expect(html).toContain('Someone owns the box.')
    })
  )

  it.effect('rejects a decision naming no listed option', () =>
    Effect.gen(function* () {
      const bad = `{
        "title": "T",
        "status": "proposed",
        "context": "C.",
        "options": [{ "name": "a", "summary": "A." }, { "name": "b", "summary": "B." }],
        "decision": { "option": "c", "why": "W." },
        "consequences": { "positive": [], "negative": [] }
      }`

      const failure = yield* buildPage(authorPage(jsonFigure('decision-record', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('decision-record')
        expect(failure.path).toBe('decision.option')
      }
    })
  )

  it.effect('rejects a single option', () =>
    Effect.gen(function* () {
      const bad = `{
        "title": "T",
        "status": "proposed",
        "context": "C.",
        "options": [{ "name": "a", "summary": "A." }],
        "decision": { "option": "a", "why": "W." },
        "consequences": { "positive": [], "negative": [] }
      }`

      const failure = yield* buildPage(authorPage(jsonFigure('decision-record', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toBe('options')
      }
    })
  )

  it.effect('rebuilds idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(jsonFigure('decision-record', DECISION_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('decision-record', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('decision.option')
      expect(detail).toContain('consequences')
    }

    expect(decisionRecordComponent.examples.length).toBeGreaterThan(0)
  })
})

describe('pros-cons', () => {
  it.effect('renders two columns with weights and a verdict', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('pros-cons', PROS_CONS_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('Reads privately')
      expect(html).toContain('+2')
      expect(html).toContain('Needs patching')
      expect(html).toContain('Take the box.')
    })
  )

  it.effect('rejects an empty side and an oversized weight', () =>
    Effect.gen(function* () {
      const emptyCons = `{"pros": [{"text": "P."}], "cons": []}`

      const first = yield* buildPage(authorPage(jsonFigure('pros-cons', emptyCons))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(first, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(first, 'BlockDecodeError')) {
        expect(first.path).toBe('cons')
      }

      const longWeight = `{"pros": [{"text": "P.", "weight": "way too long a marker"}], "cons": [{"text": "C."}]}`

      const second = yield* buildPage(authorPage(jsonFigure('pros-cons', longWeight))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(second, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(second, 'BlockDecodeError')) {
        expect(second.path).toBe('pros[0].weight')
      }
    })
  )

  it.effect('rebuilds idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(jsonFigure('pros-cons', PROS_CONS_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('pros-cons', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('verdict')
      expect(detail).toContain('weight')
    }

    expect(prosConsComponent.examples.length).toBeGreaterThan(0)
    expect(prosConsComponent.clientBundle).toBe(null)
  })
})
