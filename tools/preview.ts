import { readFile, stat } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'

import { Effect } from 'effect'

import { MAX_HTML_BYTES } from '../lib/html-limits.js'
import { parsePreviewArgs } from './preview-args.js'
import type { PreviewOptions } from './preview-args.js'
import { resolveChromium, runPreviewBrowser } from './preview-browser.js'
import type { PreviewProblem } from './preview-browser.js'
import { PreviewUsageError, type PreviewFailure } from './preview-error.js'
import { startPreviewServer } from './preview-server.js'

interface ExitFailure {
  readonly kind: 'usage' | 'request'
  readonly message: string
}

interface PreviewScreenshots {
  readonly desktop: string
  readonly mobile: string
  readonly desktopDark: string
  readonly mobileDark: string
}

interface PreviewTiles {
  readonly desktop: ReadonlyArray<string>
  readonly mobile: ReadonlyArray<string>
  readonly desktopDark: ReadonlyArray<string>
  readonly mobileDark: ReadonlyArray<string>
}

interface PreviewSummary {
  readonly url: string
  readonly screenshots: PreviewScreenshots
  readonly tiles: PreviewTiles
  readonly problems: ReadonlyArray<PreviewProblem>
  readonly elapsedMs: number
}

function usageFailure(error: PreviewUsageError): ExitFailure {
  return { kind: 'usage' as const, message: error.message }
}

function requestFailure(error: PreviewFailure): ExitFailure {
  return { kind: 'request' as const, message: error.message }
}

function ensureReadableFile(file: string): Effect.Effect<void, PreviewUsageError> {
  return Effect.gen(function* () {
    const info = yield* Effect.tryPromise({
      try: () => stat(file),
      catch: () => new PreviewUsageError({ message: `cannot read file: ${file}` })
    })

    if (info.size > MAX_HTML_BYTES) {
      return yield* Effect.fail(
        new PreviewUsageError({
          message: `file exceeds ${String(MAX_HTML_BYTES)} byte limit: ${file}`
        })
      )
    }

    const body = yield* Effect.tryPromise({
      try: () => readFile(file),
      catch: () => new PreviewUsageError({ message: `cannot read file: ${file}` })
    })

    if (body.length > MAX_HTML_BYTES) {
      return yield* Effect.fail(
        new PreviewUsageError({
          message: `file exceeds ${String(MAX_HTML_BYTES)} byte limit: ${file}`
        })
      )
    }
  })
}

function screenshotStem(file: string): string {
  const base = basename(file)
  const ext = extname(base)

  if (ext.length === 0) {
    return base
  }

  return base.slice(0, base.length - ext.length)
}

function resolveOutDir(options: PreviewOptions): string {
  if (options.outDir !== null) {
    return options.outDir
  }

  return dirname(options.file)
}

function runServe(options: PreviewOptions): Effect.Effect<void, ExitFailure> {
  return Effect.acquireUseRelease(
    startPreviewServer(options.file, options.port).pipe(Effect.mapError(requestFailure)),
    (server) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          process.stdout.write(`${server.url}\n`)
        })

        yield* Effect.never
      }),
    (server) => server.close.pipe(Effect.orElseSucceed(() => undefined))
  )
}

function runDefault(options: PreviewOptions): Effect.Effect<void, ExitFailure> {
  return Effect.gen(function* () {
    const started = yield* Effect.sync(() => Date.now())
    const outDir = resolveOutDir(options)
    const stem = screenshotStem(options.file)

    const summary: PreviewSummary = yield* Effect.acquireUseRelease(
      startPreviewServer(options.file, options.port).pipe(Effect.mapError(requestFailure)),
      (server) =>
        Effect.gen(function* () {
          const executable = yield* resolveChromium().pipe(Effect.mapError(usageFailure))

          const result = yield* runPreviewBrowser({
            executable,
            url: server.url,
            outDir,
            stem
          }).pipe(Effect.mapError(requestFailure))

          const finished = yield* Effect.sync(() => Date.now())

          return {
            url: server.url,
            screenshots: {
              desktop: result.desktopShot,
              mobile: result.mobileShot,
              desktopDark: result.desktopDarkShot,
              mobileDark: result.mobileDarkShot
            },
            tiles: {
              desktop: result.desktopTiles,
              mobile: result.mobileTiles,
              desktopDark: result.desktopDarkTiles,
              mobileDark: result.mobileDarkTiles
            },
            problems: result.problems,
            elapsedMs: finished - started
          }
        }),
      (server) => server.close.pipe(Effect.orElseSucceed(() => undefined))
    ).pipe(
      (report) => Effect.timeout(report, '15 seconds'),
      Effect.catchTag('TimeoutError', () =>
        Effect.fail({ kind: 'request' as const, message: 'preview timed out after 15 seconds' })
      )
    )

    yield* Effect.sync(() => {
      process.stdout.write(`${JSON.stringify(summary)}\n`)
    })

    if (summary.problems.length > 0) {
      yield* Effect.sync(() => {
        process.exitCode = 1
      })
    }
  })
}

const program = Effect.gen(function* () {
  const options = yield* parsePreviewArgs(process.argv.slice(2)).pipe(Effect.mapError(usageFailure))

  yield* ensureReadableFile(options.file).pipe(Effect.mapError(usageFailure))

  if (options.serve) {
    yield* runServe(options)
  } else {
    yield* runDefault(options)
  }
})

Effect.runPromise(program).catch((cause: { kind: string; message: string }) => {
  if (cause.kind === 'usage') {
    process.stderr.write(`${cause.message}\n`)
  } else {
    process.stderr.write(`error: ${cause.message}\n`)
  }

  process.exit(1)
})
