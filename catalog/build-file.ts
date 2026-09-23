import { Effect } from 'effect'

import { buildPage } from './build.js'
import type { BuildError } from './build.js'
import { CatalogFileError } from './errors.js'
import { CatalogFileStore } from './services/catalog-file-store.js'
import { ClientBundleStore } from './services/client-bundle-store.js'

/**
 * File-level build used by `aha build` and the showcase generator.
 * Reads the source, builds the page, and writes the output file when one
 * is given; otherwise the caller prints the returned HTML.
 */

export type BuildFileError = BuildError | CatalogFileError

export interface BuildFileRequest {
  readonly input: string
  readonly output: string | null
}

export interface BuildFileResult {
  readonly html: string
  readonly wrote: boolean
}

export function runBuildFile(
  request: BuildFileRequest
): Effect.Effect<BuildFileResult, BuildFileError, CatalogFileStore | ClientBundleStore> {
  return Effect.gen(function* () {
    const store = yield* CatalogFileStore
    const source = yield* store.readTextFile(request.input)
    const html = yield* buildPage(source)

    if (request.output === null) {
      return { html, wrote: false }
    }

    yield* store.writeTextFile(request.output, html)

    return { html, wrote: true }
  })
}
