import { Effect, Layer } from 'effect'

import type { EnvMap } from '../lib/headers.js'
import { runBuildFile } from '../catalog/build-file.js'
import { formatComponentDetail, formatComponentsList } from '../catalog/components.js'
import { CatalogFileStore } from '../catalog/services/catalog-file-store.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'
import { runCliRequest } from './client.js'
import type { BuildRequest, CliRequest, ComponentsRequest } from './parser.js'
import { parseCliArgs } from './parser.js'

function snapshotEnv(): EnvMap {
  const envRecord: EnvMap = {}

  for (const key of Object.keys(process.env)) {
    envRecord[key] = process.env[key]
  }

  return envRecord
}

interface ExitSuccess {
  readonly kind: 'ok'
  readonly output: string
}

interface ExitFailure {
  readonly kind: 'usage' | 'request'
  readonly message: string
}

const catalogLayers = Layer.mergeAll(CatalogFileStore.layer, ClientBundleStore.layer)

function runBuild(request: BuildRequest): Effect.Effect<ExitSuccess, ExitFailure> {
  return runBuildFile({ input: request.input, output: request.output }).pipe(
    Effect.map((result): ExitSuccess => {
      if (request.output === null) {
        return { kind: 'ok', output: result.html }
      }

      return { kind: 'ok', output: `built ${request.output}` }
    }),
    Effect.provide(catalogLayers),
    Effect.catchTags({
      UnknownComponentError: (error) =>
        Effect.fail({ kind: 'request' as const, message: error.message }),
      BlockDecodeError: (error) =>
        Effect.fail({ kind: 'request' as const, message: error.message }),
      ClientBundleMissingError: (error) =>
        Effect.fail({ kind: 'request' as const, message: error.message }),
      CatalogFileError: (error) => Effect.fail({ kind: 'request' as const, message: error.message })
    })
  )
}

function runComponents(request: ComponentsRequest): Effect.Effect<ExitSuccess, ExitFailure> {
  return Effect.suspend(() => {
    if (request.name === null) {
      return Effect.succeed({ kind: 'ok', output: formatComponentsList(request.asJson) })
    }

    const detail = formatComponentDetail(request.name, request.asJson)

    if (detail === null) {
      return Effect.fail({
        kind: 'usage' as const,
        message: `unknown component: ${request.name}`
      })
    }

    return Effect.succeed({ kind: 'ok', output: detail })
  })
}

function isNetworkRequest(
  request: CliRequest
): request is Exclude<CliRequest, BuildRequest | ComponentsRequest> {
  return request.command !== 'build' && request.command !== 'components'
}

function runNetwork(
  request: Exclude<CliRequest, BuildRequest | ComponentsRequest>
): Effect.Effect<ExitSuccess, ExitFailure> {
  return runCliRequest(request).pipe(
    Effect.map((output): ExitSuccess => ({ kind: 'ok', output })),
    Effect.catchTags({
      CliUsageError: (error) => Effect.fail({ kind: 'usage' as const, message: error.message }),
      CliRequestError: (error) => Effect.fail({ kind: 'request' as const, message: error.message })
    })
  )
}

const program = Effect.gen(function* () {
  const request = yield* parseCliArgs(process.argv.slice(2), snapshotEnv()).pipe(
    Effect.catchTag('CliUsageError', (error) =>
      Effect.fail({ kind: 'usage' as const, message: error.message })
    )
  )

  if (request.command === 'build') {
    return yield* runBuild(request)
  }

  if (request.command === 'components') {
    return yield* runComponents(request)
  }

  if (isNetworkRequest(request)) {
    return yield* runNetwork(request)
  }

  return yield* Effect.fail({ kind: 'usage' as const, message: 'unknown command' })
})

Effect.runPromise(program).then(
  (result) => {
    process.stdout.write(`${result.output}\n`)
  },
  (cause: ExitFailure) => {
    if (cause.kind === 'usage') {
      process.stderr.write(`${cause.message}\n`)
    } else {
      process.stderr.write(`error: ${cause.message}\n`)
    }

    process.exit(1)
  }
)
