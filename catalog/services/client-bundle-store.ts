import { Context, Effect, Layer } from 'effect'
import { existsSync, realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ClientBundleMissingError } from '../errors.js'

/**
 * Client bundle loading. Bundles are compact IIFEs built by the repo build
 * into dist/catalog; this service finds that directory both from the built
 * launcher (dist/cli/aha.js) and from source checkouts, and reads only the
 * bundles the page actually uses.
 */

export interface ClientBundleService {
  readonly loadBundle: (name: string) => Effect.Effect<string, ClientBundleMissingError>
}

export function bundleDirCandidates(): ReadonlyArray<string> {
  const out: Array<string> = []
  const argvEntry = process.argv[1]

  if (argvEntry !== undefined) {
    try {
      const launched = realpathSync(resolve(argvEntry))
      out.push(join(dirname(launched), '..', 'catalog'))
      out.push(join(dirname(launched), 'catalog'))
    } catch {
      out.push(join(process.cwd(), 'dist', 'catalog'))
    }
  }

  try {
    const here = fileURLToPath(import.meta.url)
    out.push(join(dirname(here), '..', '..', 'dist', 'catalog'))
  } catch {
    out.push(join(process.cwd(), 'dist', 'catalog'))
  }

  out.push(join(process.cwd(), 'dist', 'catalog'))

  return out
}

export function pickBundleDir(
  candidates: ReadonlyArray<string>,
  exists: (dir: string) => boolean
): string | null {
  for (const candidate of candidates) {
    if (exists(candidate)) {
      return candidate
    }
  }

  return null
}

function failMissing(name: string): Effect.Effect<never, ClientBundleMissingError> {
  return Effect.fail(new ClientBundleMissingError({ name }))
}

export class ClientBundleStore extends Context.Service<ClientBundleStore, ClientBundleService>()(
  '@aha/ClientBundleStore',
  {
    make: Effect.succeed({
      loadBundle: (name: string) =>
        Effect.gen(function* () {
          const dir = pickBundleDir(bundleDirCandidates(), (candidate) =>
            existsSync(join(candidate, name))
          )

          if (dir === null) {
            return yield* failMissing(name)
          }

          const text = yield* Effect.tryPromise({
            try: () => readFile(join(dir, name), 'utf8'),
            catch: () => new ClientBundleMissingError({ name })
          })

          return text
        })
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}
