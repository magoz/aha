import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { findBlocks, findRootBlocks } from '../catalog/blocks.js'
import { allCatalogComponents } from '../catalog/categories.js'
import { buildShowcasePage } from '../catalog/showcase.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const NESTED_SOURCE = [
  '<!doctype html>',
  '<html><head><title>t</title></head><body>',
  '<div data-aha="scenarios">',
  '<section data-scenario="3%"><p>Cheap.</p>',
  '<figure data-aha="line-chart">',
  '<script type="application/json">{"x": {"kind": "category"}, "series": [{"name": "b", "values": [{"x": "a", "y": 1}]}]}</script>',
  '</figure>',
  '</section>',
  '</div>',
  '</body></html>'
].join('\n')

const FOOTER_TEMPLATE = [
  '<!doctype html>',
  '<html><head><style>:root { --measure: 44rem; }</style></head>',
  '<body><header class="doc"><p>old header</p></header>',
  '<main><p>old body</p></main>',
  '<footer class="doc"><p class="colophon"><span>aha.oox.sh</span><span>rev 2026-09-20</span><span>Explainer</span></p></footer>',
  '</body></html>'
].join('\n')

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('nested blocks', () => {
  it('finds only root blocks at the top level', () => {
    expect(findBlocks(NESTED_SOURCE).length).toBe(1)
    expect(findRootBlocks(NESTED_SOURCE).length).toBe(1)
    expect(findRootBlocks(NESTED_SOURCE)[0]?.name).toBe('scenarios')
  })

  it.effect('fails nested unknown components with their name', () =>
    Effect.gen(function* () {
      const source = NESTED_SOURCE.replace('data-aha="line-chart"', 'data-aha="nope"')
      const failure = yield* buildPage(source).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(failure, 'UnknownComponentError')).toBe(true)

      if (Predicate.isTagged(failure, 'UnknownComponentError')) {
        expect(failure.name).toBe('nope')
      }
    })
  )
})

describe('showcase footer', () => {
  it.effect('stamps the build date and component count, not the template colophon', () =>
    Effect.gen(function* () {
      const html = yield* buildShowcasePage(FOOTER_TEMPLATE).pipe(Effect.provide(stubBundles))

      expect(html).not.toContain('rev 2026-09-20')
      expect(html).not.toContain('>Explainer<')
      expect(html).toMatch(/rev \d{4}-\d{2}-\d{2}/)
      expect(html).toContain(`${String(allCatalogComponents().length)} components`)
    })
  )
})
