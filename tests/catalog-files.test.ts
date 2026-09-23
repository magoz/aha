import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { runBuildFile } from '../catalog/build-file.js'
import { CatalogFileError } from '../catalog/errors.js'
import { buildShowcasePage } from '../catalog/showcase.js'
import { CatalogFileStore } from '../catalog/services/catalog-file-store.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'
import { parseCliArgs } from '../cli/parser.js'

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

function memoryFiles(initial: Array<[string, string]>) {
  const files = new Map<string, string>(initial)

  return Layer.succeed(CatalogFileStore)({
    readTextFile: (path: string) =>
      Effect.gen(function* () {
        const body = files.get(path)

        if (body === undefined) {
          return yield* Effect.fail(
            new CatalogFileError({ operation: 'read', path, detail: 'missing' })
          )
        }

        return body
      }),
    writeTextFile: (path: string, content: string) =>
      Effect.sync(() => {
        files.set(path, content)
      })
  })
}

const TEMPLATE = [
  '<!doctype html>',
  '<html><head><style>:root { --measure: 44rem; }</style></head>',
  '<body><header class="doc"><p>old header</p></header>',
  '<main><p>old body</p></main>',
  '</body></html>'
].join('\n')

describe('catalog files and showcase', () => {
  it.effect('builds a file through the file and bundle services', () =>
    Effect.gen(function* () {
      const source = [
        '<html><body>',
        '<aside data-aha="callout"><p>Keep the surface small.</p></aside>',
        '</body></html>'
      ].join('\n')

      const layers = Layer.mergeAll(memoryFiles([['/in.html', source]]), stubBundles)

      const result = yield* runBuildFile({ input: '/in.html', output: '/out.html' }).pipe(
        Effect.provide(layers)
      )

      expect(result.wrote).toBe(true)
      expect(result.html).toContain('class="callout note"')
    })
  )

  it.effect('builds the showcase from the house template', () =>
    Effect.gen(function* () {
      const html = yield* buildShowcasePage(TEMPLATE).pipe(Effect.provide(stubBundles))

      expect(html).toContain('showcase-panes')
      expect(html).toContain('line-chart')
      expect(html).toContain('time-strips')
      expect(html).toContain('data-table')
      expect(html).toContain('callout')
      expect(html).toContain('390px')
      expect(html).toContain('Example JSON')
    })
  )

  it.effect('parses build and components without any token', () =>
    Effect.gen(function* () {
      const build = yield* parseCliArgs(['build', 'in.html', '-o', 'out.html'], {})

      expect(build.command).toBe('build')

      if (build.command === 'build') {
        expect(build.input).toBe('in.html')
        expect(build.output).toBe('out.html')
      }

      const components = yield* parseCliArgs(['components', 'line-chart'], {})

      expect(components.command).toBe('components')

      if (components.command === 'components') {
        expect(components.name).toBe('line-chart')
        expect(components.asJson).toBe(false)
      }

      const failure = yield* Effect.flip(parseCliArgs(['build'], {}))

      expect(Predicate.isTagged(failure, 'CliUsageError')).toBe(true)
    })
  )
})
