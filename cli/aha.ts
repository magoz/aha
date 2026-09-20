import { Effect } from 'effect'

import type { EnvMap } from '../lib/headers.js'
import { runCliRequest } from './client.js'
import { parseCliArgs } from './parser.js'

function snapshotEnv(): EnvMap {
  const envRecord: EnvMap = {}

  for (const key of Object.keys(process.env)) {
    envRecord[key] = process.env[key]
  }

  return envRecord
}

const program = Effect.gen(function* () {
  const request = yield* parseCliArgs(process.argv.slice(2), snapshotEnv()).pipe(
    Effect.catchTag('CliUsageError', (error) =>
      Effect.fail({ kind: 'usage' as const, message: error.message })
    )
  )

  const output = yield* runCliRequest(request).pipe(
    Effect.catchTags({
      CliUsageError: (error) => Effect.fail({ kind: 'usage' as const, message: error.message }),
      CliRequestError: (error) => Effect.fail({ kind: 'request' as const, message: error.message })
    })
  )

  yield* Effect.sync(() => {
    process.stdout.write(`${output}\n`)
  })
})

Effect.runPromise(program).catch((cause: { kind: string; message: string }) => {
  if (cause.kind === 'usage') {
    process.stderr.write(`${cause.message}\n`)
  } else {
    process.stderr.write(`error: ${cause.message}\n`)
  }

  process.exit(1)
})
