import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import {
  classifyLogEntry,
  findDebuggerUrl,
  lookupChromiumOnPath,
  runPreviewBrowser
} from '../tools/preview-browser.js'
import { startPreviewServer } from '../tools/preview-server.js'

const CLEAN_HTML =
  '<!doctype html><html><head><title>clean</title></head><body><p>clean page</p></body></html>'

const NOISY_HTML =
  '<!doctype html><html><head><title>noisy</title><script src="https://example.com/x.js"></script></head><body><p>noisy</p><script>throw new Error(\'boom\')</script></body></html>'

function fileSize(path: string): Effect.Effect<number, Error> {
  return Effect.tryPromise({
    try: () => stat(path).then((info) => info.size),
    catch: () => new Error(`stat failed: ${path}`)
  })
}

describe('preview browser helpers', () => {
  it('finds the DevTools url in Chromium stderr', () => {
    expect(
      findDebuggerUrl('DevTools listening on ws://127.0.0.1:37321/devtools/browser/da939937-abc\n')
    ).toBe('ws://127.0.0.1:37321/devtools/browser/da939937-abc')

    expect(findDebuggerUrl('still starting up\n')).toBe(null)
  })

  it('tags Content Security Policy violations as csp', () => {
    expect(
      classifyLogEntry(
        'security',
        "Refused to load the script 'https://example.com/x.js' because it violates the following Content Security Policy directive."
      )
    ).toBe('csp')

    expect(classifyLogEntry('javascript', 'TypeError: oops is not defined')).toBe('console')
  })
})

describe('preview browser capture', () => {
  it.effect(
    'captures desktop and mobile screenshots under the production CSP',
    () =>
      Effect.gen(function* () {
        const executable = yield* lookupChromiumOnPath()

        if (executable === null) {
          return
        }

        const dir = yield* Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), 'aha-preview-')),
          catch: () => new Error('mkdtemp failed')
        })

        try {
          const file = join(dir, 'clean.html')

          yield* Effect.tryPromise({
            try: () => writeFile(file, CLEAN_HTML),
            catch: () => new Error('write failed')
          })

          return yield* Effect.acquireUseRelease(
            startPreviewServer(file, null).pipe(Effect.mapError(() => new Error('server failed'))),
            (server) =>
              Effect.gen(function* () {
                const result = yield* runPreviewBrowser({
                  executable,
                  url: server.url,
                  outDir: join(dir, 'shots'),
                  stem: 'clean'
                }).pipe(Effect.mapError(() => new Error('capture failed')))

                expect(result.problems).toEqual([])

                const desktopSize = yield* fileSize(result.desktopShot)

                expect(desktopSize).toBeGreaterThan(1000)

                const mobileSize = yield* fileSize(result.mobileShot)

                expect(mobileSize).toBeGreaterThan(1000)

                const bytes = yield* Effect.tryPromise({
                  try: () => readFile(result.desktopShot),
                  catch: () => new Error('read shot failed')
                })

                expect(bytes[0]).toBe(137)
                expect(bytes[1]).toBe(80)
                expect(bytes[2]).toBe(78)
                expect(bytes[3]).toBe(71)
              }),
            (server) => server.close.pipe(Effect.orElseSucceed(() => undefined))
          )
        } finally {
          yield* Effect.tryPromise({
            try: () => rm(dir, { recursive: true, force: true }),
            catch: () => new Error('cleanup failed')
          })
        }
      }),
    30000
  )

  it.effect(
    'reports CSP violations and uncaught exceptions as problems',
    () =>
      Effect.gen(function* () {
        const executable = yield* lookupChromiumOnPath()

        if (executable === null) {
          return
        }

        const dir = yield* Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), 'aha-preview-')),
          catch: () => new Error('mkdtemp failed')
        })

        try {
          const file = join(dir, 'noisy.html')

          yield* Effect.tryPromise({
            try: () => writeFile(file, NOISY_HTML),
            catch: () => new Error('write failed')
          })

          return yield* Effect.acquireUseRelease(
            startPreviewServer(file, null).pipe(Effect.mapError(() => new Error('server failed'))),
            (server) =>
              Effect.gen(function* () {
                const result = yield* runPreviewBrowser({
                  executable,
                  url: server.url,
                  outDir: join(dir, 'shots'),
                  stem: 'noisy'
                }).pipe(Effect.mapError(() => new Error('capture failed')))

                const kinds = result.problems.map((problem) => problem.kind)

                expect(kinds.includes('csp')).toBe(true)
                expect(kinds.includes('exception')).toBe(true)
              }),
            (server) => server.close.pipe(Effect.orElseSucceed(() => undefined))
          )
        } finally {
          yield* Effect.tryPromise({
            try: () => rm(dir, { recursive: true, force: true }),
            catch: () => new Error('cleanup failed')
          })
        }
      }),
    30000
  )
})
