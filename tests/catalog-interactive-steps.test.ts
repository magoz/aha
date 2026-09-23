import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatDuration } from '../catalog/interactive/steps.js'
import { stepsComponent } from '../catalog/interactive/steps.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const VALID_MARKUP = [
  '<li data-step="Brew and review" data-duration="300">',
  '<p>Pour the coffee and read the diff stat.</p>',
  '<p data-ready>The diff stat fits on one screen.</p>',
  '</li>',
  '<li data-step="Ship behind the flag">',
  '<p>Merge and deploy with the flag off.</p>',
  '<p data-ready>Staff traffic runs clean.</p>',
  '</li>'
].join('\n')

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function stepsBlock(markup: string): string {
  return `<ol data-aha="steps">\n${markup}\n</ol>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('steps', () => {
  it.effect('renders a plain ordered list with durations and cues', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(stepsBlock(VALID_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('<ol data-aha="steps"')
      expect(html).toContain('Brew and review')
      expect(html).toContain('5 min')
      expect(html).toContain('data-ready')
      expect(html).toContain('data-duration="300"')
    })
  )

  it.effect('rejects steps without titles', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(authorPage(stepsBlock('<li><p>No title.</p></li>'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('steps')
      }
    })
  )

  it.effect('rebuilds idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(stepsBlock(VALID_MARKUP))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).toContain('/* bundle:steps.client.js */')
    })
  )

  it('formats durations for one-line chips', () => {
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(300)).toBe('5 min')
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(3900)).toBe('1 h 5 min')
    expect(stepsComponent.examples.length).toBeGreaterThan(0)
  })
})
