import { Effect } from 'effect'

import { readConfig } from '../lib/config.js'
import type { HeaderMap } from '../lib/headers.js'
import { handleAhaRequest } from '../lib/http.js'
import type { AhaResponse } from '../lib/http.js'
import { r2Layer } from '../lib/storage-r2.js'
import type { LengthGuard, R2BucketLike } from '../lib/storage-r2.js'

// Workers runtime global: a pass-through stream that errors unless exactly `length` bytes pass.
declare const FixedLengthStream: new (length: number) => TransformStream<Uint8Array, Uint8Array>

export interface WorkerEnv {
  readonly AHA_BUCKET: R2BucketLike
  readonly AHA_OWNER_TOKEN?: string
  readonly AHA_PUBLIC_URL?: string
}

const fixedLength: LengthGuard = (body, length) => body.pipeThrough(new FixedLengthStream(length))

function requestHeaders(request: Request): HeaderMap {
  const out: HeaderMap = {}

  request.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value
  })

  return out
}

function toWebResponse(response: AhaResponse): Response {
  return new Response(response.body, { status: response.status, headers: response.headers })
}

function internalError(): Response {
  return new Response('internal error', {
    status: 500,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  })
}

// Runs one request against the bucket binding. Lives outside the Worker's main module (whose named
// exports would become entrypoints) so tests can supply a fake bucket and length guard.
export function handleWorkerRequest(
  request: Request,
  env: WorkerEnv,
  guardLength: LengthGuard = fixedLength
): Promise<Response> {
  const program = readConfig({
    AHA_OWNER_TOKEN: env.AHA_OWNER_TOKEN,
    AHA_PUBLIC_URL: env.AHA_PUBLIC_URL
  }).pipe(
    Effect.flatMap((config) =>
      handleAhaRequest(
        {
          method: request.method,
          url: request.url,
          headers: requestHeaders(request),
          body: request.body
        },
        config
      ).pipe(Effect.provide(r2Layer(env.AHA_BUCKET, guardLength)))
    )
  )

  return Effect.runPromise(program).then(toWebResponse, internalError)
}
