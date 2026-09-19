import { createServer } from 'node:http'
import type { IncomingHttpHeaders } from 'node:http'

import { Effect } from 'effect'

import type { EnvMap, HeaderMap } from '../lib/headers.js'
import { readConfig } from '../lib/config.js'
import { handlePlansRequest } from '../lib/http.js'
import type { PlansRequest } from '../lib/http.js'
import { s3StorageLayer } from '../lib/storage-s3.js'

function lowercaseHeaders(raw: IncomingHttpHeaders): HeaderMap {
  const out: HeaderMap = {}

  for (const key of Object.keys(raw)) {
    const value = raw[key]

    if (value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      const first = value[0]

      if (first === undefined) {
        continue
      }

      out[key.toLowerCase()] = first
    } else {
      out[key.toLowerCase()] = value
    }
  }

  return out
}

function mergeChunks(chunks: Array<Uint8Array>, total: number): Uint8Array {
  const merged = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

function readBody(chunks: Array<Uint8Array>): Uint8Array | null {
  let total = 0

  for (const chunk of chunks) {
    total += chunk.length
  }

  if (total === 0) {
    return null
  }

  return mergeChunks(chunks, total)
}

function snapshotEnv(): EnvMap {
  const envRecord: EnvMap = {}

  for (const key of Object.keys(process.env)) {
    envRecord[key] = process.env[key]
  }

  return envRecord
}

export function startNodeServer(port: number, host: string): void {
  const server = createServer((req, res) => {
    const chunks: Array<Uint8Array> = []

    req.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      const program = Effect.gen(function* () {
        const config = yield* readConfig(snapshotEnv())
        const layer = s3StorageLayer(config)
        const headers = lowercaseHeaders(req.headers)

        const plansRequest: PlansRequest = {
          method: req.method ?? 'GET',
          url: req.url ?? '/',
          headers,
          body: readBody(chunks)
        }

        return yield* handlePlansRequest(plansRequest, config).pipe(Effect.provide(layer))
      })

      Effect.runPromise(program).then(
        (response) => {
          res.statusCode = response.status

          for (const key of Object.keys(response.headers)) {
            const value = response.headers[key]

            if (value !== undefined) {
              res.setHeader(key, value)
            }
          }

          if (response.body === null) {
            res.end()
          } else {
            res.end(Buffer.from(response.body))
          }
        },
        () => {
          res.statusCode = 500
          res.setHeader('content-type', 'text/plain; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end('internal error')
        }
      )
    })
  })

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
