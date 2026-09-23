import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { HTML_CONTENT_TYPE } from '../lib/html-limits.js'
import { withSecurityHeaders } from '../lib/security-headers.js'
import { startPreviewServer } from '../tools/preview-server.js'

const SAMPLE_HTML =
  '<!doctype html><html><head><title>preview</title></head><body><p>hello</p></body></html>'

describe('preview server', () => {
  it.effect('serves the file with production security headers and 404s elsewhere', () =>
    Effect.gen(function* () {
      const dir = yield* Effect.tryPromise({
        try: () => mkdtemp(join(tmpdir(), 'aha-preview-')),
        catch: () => new Error('mkdtemp failed')
      })

      try {
        const file = join(dir, 'page.html')

        yield* Effect.tryPromise({
          try: () => writeFile(file, SAMPLE_HTML),
          catch: () => new Error('write failed')
        })

        return yield* Effect.acquireUseRelease(
          startPreviewServer(file, null).pipe(Effect.mapError(() => new Error('server failed'))),
          (server) =>
            Effect.gen(function* () {
              const response = yield* Effect.tryPromise({
                try: () => fetch(server.url),
                catch: () => new Error('fetch failed')
              })

              expect(response.status).toBe(200)

              const body = yield* Effect.tryPromise({
                try: () => response.text(),
                catch: () => new Error('body failed')
              })

              expect(body).toBe(SAMPLE_HTML)

              const expected = withSecurityHeaders({ 'content-type': HTML_CONTENT_TYPE })

              for (const key of Object.keys(expected)) {
                const want = expected[key]

                if (want !== undefined) {
                  expect(response.headers.get(key)).toBe(want)
                }
              }

              const missing = yield* Effect.tryPromise({
                try: () => fetch(`${server.url}nope`),
                catch: () => new Error('fetch failed')
              })

              expect(missing.status).toBe(404)

              yield* Effect.tryPromise({
                try: () => missing.text(),
                catch: () => new Error('drain failed')
              })

              const posted = yield* Effect.tryPromise({
                try: () => fetch(server.url, { method: 'POST', body: 'x' }),
                catch: () => new Error('fetch failed')
              })

              expect(posted.status).toBe(404)

              yield* Effect.tryPromise({
                try: () => posted.text(),
                catch: () => new Error('drain failed')
              })
            }),
          (server) => server.close.pipe(Effect.orElseSucceed(() => undefined))
        )
      } finally {
        yield* Effect.tryPromise({
          try: () => rm(dir, { recursive: true, force: true }),
          catch: () => new Error('cleanup failed')
        })
      }
    })
  )
})
