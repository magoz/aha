import { Context, Effect, Layer } from 'effect'
import { readFile, writeFile } from 'node:fs/promises'

import { CatalogFileError } from '../errors.js'

/**
 * File access for catalog commands. The live layer uses node fs; tests
 * provide an in-memory fake. Errors stay in the TaggedError channel.
 */

export interface CatalogFileService {
  readonly readTextFile: (path: string) => Effect.Effect<string, CatalogFileError>
  readonly writeTextFile: (path: string, content: string) => Effect.Effect<void, CatalogFileError>
}

function readDetail(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message
  }

  return 'unknown IO failure'
}

export class CatalogFileStore extends Context.Service<CatalogFileStore, CatalogFileService>()(
  '@aha/CatalogFileStore',
  {
    make: Effect.succeed({
      readTextFile: (path: string) =>
        Effect.tryPromise({
          try: () => readFile(path, 'utf8'),
          catch: (cause) =>
            new CatalogFileError({ operation: 'read', path, detail: readDetail(cause) })
        }),
      writeTextFile: (path: string, content: string) =>
        Effect.tryPromise({
          try: () => writeFile(path, content, 'utf8'),
          catch: (cause) =>
            new CatalogFileError({ operation: 'write', path, detail: readDetail(cause) })
        })
    })
  }
) {
  static layer = Layer.effect(this, this.make)
}
