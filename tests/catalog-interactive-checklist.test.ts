import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { checklistComponent } from '../catalog/interactive/checklist.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const VALID_MARKUP = [
  '<li data-group="Before the flag"></li>',
  '<li>Suite green on a clean checkout</li>',
  '<li>Flag off in production</li>',
  '<li data-group="After the flag"></li>',
  '<li>Changelog entry names the flag</li>'
].join('\n')

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function checklistBlock(markup: string): string {
  return `<ul data-aha="checklist">\n${markup}\n</ul>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('checklist', () => {
  it.effect('renders groups, boxes and a static progress count', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(checklistBlock(VALID_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('Before the flag')
      expect(html).toContain('Suite green')
      expect(html).toContain('type="checkbox"')
      expect(html).toContain('0 of 3')
      expect(html).toContain('aria-live="polite"')
    })
  )

  it.effect('rejects a list with only group rows', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(
        authorPage(checklistBlock('<li data-group="Empty"></li>'))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('checklist')
      }
    })
  )

  it.effect('rebuilds idempotently without doubling boxes', () =>
    Effect.gen(function* () {
      const source = authorPage(checklistBlock(VALID_MARKUP))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first.split('type="checkbox"').length - 1).toBe(3)
    })
  )

  it('ships a grouped example', () => {
    expect(checklistComponent.examples.length).toBeGreaterThan(0)
    expect(checklistComponent.examples[0]?.markup).toContain('data-group')
    expect(checklistComponent.clientBundle).toBe('checklist.client.js')
  })
})
