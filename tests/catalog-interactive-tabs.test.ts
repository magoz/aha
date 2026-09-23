import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { tabsComponent } from '../catalog/interactive/tabs.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const VALID_MARKUP = [
  '<section data-tab="3%">',
  '<p>At 3% the payment clears in 41 months.</p>',
  '</section>',
  '<section data-tab="4%">',
  '<p>At 4% the payment clears in 44 months.</p>',
  '</section>'
].join('\n')

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function tabsBlock(markup: string): string {
  return `<div data-aha="tabs">\n${markup}\n</div>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('tabs', () => {
  it.effect('stacks labeled sections with headings without scripts', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(tabsBlock(VALID_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('data-tab="3%"')
      expect(html).toContain('41 months')
      expect(html).toContain('44 months')
      expect(html).toContain('tab-h')
      expect(html).not.toContain(' hidden')
    })
  )

  it.effect('rejects blocks without labeled sections', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(authorPage(tabsBlock('<p>No sections.</p>'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('tabs')
        expect(failure.path).toBe('children')
      }
    })
  )

  it.effect('rebuilds idempotently and inlines only its bundle', () =>
    Effect.gen(function* () {
      const source = authorPage(tabsBlock(VALID_MARKUP))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).toContain('/* bundle:tabs.client.js */')
      expect(first).not.toContain('bundle:steps.client.js')
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('tabs', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('data-tab')
    }

    expect(tabsComponent.examples.length).toBeGreaterThan(0)
    expect(tabsComponent.clientBundle).toBe('tabs.client.js')
  })
})
