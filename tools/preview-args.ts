import { Effect, Schema } from 'effect'

import { PreviewUsageError } from './preview-error.js'

export interface PreviewOptions {
  readonly file: string
  readonly outDir: string | null
  readonly serve: boolean
  readonly port: number | null
}

const PREVIEW_USAGE = 'usage: pnpm preview <file.html> [--out <dir>] [--serve] [--port <n>]'

function usageError(): Effect.Effect<never, PreviewUsageError> {
  return Effect.fail(new PreviewUsageError({ message: PREVIEW_USAGE }))
}

function parsePort(raw: string): Effect.Effect<number, PreviewUsageError> {
  return Effect.suspend(() => {
    const parsed = Number.parseInt(raw, 10)

    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
      return Effect.fail(new PreviewUsageError({ message: `invalid port: ${raw}` }))
    }

    return Effect.succeed(parsed)
  })
}

export function parsePreviewArgs(
  rawArgs: ReadonlyArray<string>
): Effect.Effect<PreviewOptions, PreviewUsageError> {
  return Effect.gen(function* () {
    const args = yield* Schema.decodeUnknownEffect(Schema.Array(Schema.String))(rawArgs).pipe(
      Effect.mapError(() => new PreviewUsageError({ message: PREVIEW_USAGE }))
    )

    let file: string | null = null
    let outDir: string | null = null
    let serve = false
    let port: number | null = null
    let index = 0

    while (index < args.length) {
      const current = args[index]

      if (current === undefined) {
        break
      }

      if (current === '--serve') {
        serve = true
        index += 1
        continue
      }

      if (current === '--out') {
        const value = args[index + 1]

        if (value === undefined || value.length === 0) {
          return yield* usageError()
        }

        outDir = value
        index += 2
        continue
      }

      if (current === '--port') {
        const value = args[index + 1]

        if (value === undefined || value.length === 0) {
          return yield* usageError()
        }

        port = yield* parsePort(value)
        index += 2
        continue
      }

      if (current.startsWith('--')) {
        return yield* usageError()
      }

      if (file !== null) {
        return yield* usageError()
      }

      file = current
      index += 1
    }

    if (file === null) {
      return yield* usageError()
    }

    return { file, outDir, serve, port }
  })
}
