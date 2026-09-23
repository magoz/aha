import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { codeDiffComponent } from '../catalog/text/code-diff.js'
import { parseDiffLines } from '../catalog/text/code-diff-render.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const VALID_JSON = `{
  "file": "gateway/policy.ts",
  "diff": "@@ -12,7 +12,7 @@ forward\\n context\\n-old line\\n+new line\\n context\\n"
}`

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function diffFigure(json: string): string {
  return `<figure data-aha="code-diff">\n<script type="application/json">${json}</script>\n</figure>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('code-diff', () => {
  it.effect('renders line numbers and a marker column', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(diffFigure(VALID_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('gateway/policy.ts')
      expect(html).toContain('class="add"')
      expect(html).toContain('class="del"')
      expect(html).toContain('>-</td>')
      expect(html).toContain('>+</td>')
      expect(html).toContain('old line')
      expect(html).toContain('new line')
    })
  )

  it('numbers both sides from the hunk header', () => {
    const lines = parseDiffLines('@@ -12,3 +20,4 @@ fn\n keep\n-was\n+is\n+more\n keep\n')

    expect(lines.length).toBe(6)

    const first = lines[0]
    const second = lines[1]
    const del = lines[2]
    const add = lines[3]

    expect(first?.kind).toBe('hunk')
    expect(second?.oldNo).toBe(12)
    expect(second?.newNo).toBe(20)
    expect(del?.oldNo).toBe(13)
    expect(del?.newNo).toBe(null)
    expect(add?.oldNo).toBe(null)
    expect(add?.newNo).toBe(21)
  })

  it.effect('rejects an empty diff', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(authorPage(diffFigure('{"diff": "  "}'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toBe('diff')
      }
    })
  )

  it.effect('rebuilds idempotently', () =>
    Effect.gen(function* () {
      const source = authorPage(diffFigure(VALID_JSON))
      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
    })
  )

  it('teaches the component through aha components output', () => {
    const detail = formatComponentDetail('code-diff', false)

    expect(detail).not.toBe(null)

    if (detail !== null) {
      expect(detail).toContain('diff')
      expect(detail).toContain('file')
      expect(detail).toContain('<figure data-aha="code-diff">')
    }

    expect(codeDiffComponent.examples.length).toBeGreaterThan(0)
  })
})
