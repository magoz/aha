import { Effect } from 'effect'

import type { EnvMap } from '../lib/headers.js'
import { readConfig } from '../lib/config.js'
import { handlePlansRequest } from '../lib/http.js'
import { s3StorageLayer } from '../lib/storage-s3.js'
import { createPlansServer } from './node-adapter.js'

function snapshotEnv(): EnvMap {
  const envRecord: EnvMap = {}

  for (const key of Object.keys(process.env)) {
    envRecord[key] = process.env[key]
  }

  return envRecord
}

export function startNodeServer(port: number, host: string): void {
  const server = createPlansServer((request) =>
    Effect.gen(function* () {
      const config = yield* readConfig(snapshotEnv())

      return yield* handlePlansRequest(request, config).pipe(Effect.provide(s3StorageLayer(config)))
    })
  )

  server.listen(port, host, () => {
    process.stdout.write(`plans dev server on http://${host}:${String(port)}\n`)
  })
}

function resolvePort(): number {
  const portRaw = process.env['PORT']

  if (portRaw === undefined) {
    return 3939
  }

  const parsed = Number.parseInt(portRaw, 10)

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
    return 3939
  }

  return parsed
}

function resolveHost(): string {
  const hostRaw = process.env['HOST']

  if (hostRaw === undefined || hostRaw.length === 0) {
    return '127.0.0.1'
  }

  return hostRaw
}

startNodeServer(resolvePort(), resolveHost())
