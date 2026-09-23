import { Effect, Layer } from 'effect'
import { dirname, join, resolve } from 'node:path'

import { buildShowcasePage, writeShowcasePage } from '../catalog/showcase.js'
import { CatalogFileStore } from '../catalog/services/catalog-file-store.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

/**
 * `pnpm catalog:showcase [-o file]`. Effect program, run once at the edge:
 * reads the house template, renders every example through `aha build`
 * itself, and writes the page (or prints it when -o is absent).
 */

const SHOWCASE_USAGE = 'usage: pnpm catalog:showcase [-o file]'

interface ShowcaseOptions {
  readonly output: string | null
}

function parseArgs(raw: ReadonlyArray<string>): ShowcaseOptions | null {
  let output: string | null = null
  let index = 0

  while (index < raw.length) {
    const current = raw[index]

    if (current === undefined) {
      break
    }

    if (current === '-o') {
      const value = raw[index + 1]

      if (value === undefined || value.length === 0) {
        return null
      }

      output = value
      index += 2
      continue
    }

    return null
  }

  return { output }
}

function resolveTemplatePath(): string {
  const entry = process.argv[1]

  if (entry !== undefined) {
    const toolsDir = dirname(resolve(entry))
    const candidate = join(toolsDir, 'templates', 'note.html')

    return candidate
  }

  return join(process.cwd(), 'templates', 'note.html')
}

const catalogLayers = Layer.mergeAll(CatalogFileStore.layer, ClientBundleStore.layer)

const program = Effect.gen(function* () {
  const options = parseArgs(process.argv.slice(2))

  if (options === null) {
    return yield* Effect.fail({ kind: 'usage' as const, message: SHOWCASE_USAGE })
  }

  const store = yield* CatalogFileStore

  const candidates: ReadonlyArray<string> = [
    resolveTemplatePath(),
    join(process.cwd(), 'templates', 'note.html')
  ]

  let template: string | null = null
  let templatePath = candidates[0] ?? join(process.cwd(), 'templates', 'note.html')

  for (const candidate of candidates) {
    const attempt = yield* store.readTextFile(candidate).pipe(
      Effect.map((html): string | null => html),
      Effect.orElseSucceed((): string | null => null)
    )

    if (attempt !== null) {
      template = attempt
      templatePath = candidate
      break
    }
  }

  if (template === null) {
    return yield* Effect.fail({
      kind: 'request' as const,
      message: `cannot read house template: ${templatePath}`
    })
  }

  const resolved: string = template

  if (options.output === null) {
    return yield* buildShowcasePage(resolved).pipe(
      Effect.mapError((error) => ({ kind: 'request' as const, message: error.message }))
    )
  }

  const written = yield* writeShowcasePage(resolved, options.output).pipe(
    Effect.mapError((error) => ({ kind: 'request' as const, message: error.message }))
  )

  return `wrote ${written}`
}).pipe(Effect.provide(catalogLayers))

Effect.runPromise(program).then(
  (result) => {
    process.stdout.write(`${result}\n`)
  },
  (cause: { kind: string; message: string }) => {
    if (cause.kind === 'usage') {
      process.stderr.write(`${cause.message}\n`)
    } else {
      process.stderr.write(`error: ${cause.message}\n`)
    }

    process.exit(1)
  }
)
