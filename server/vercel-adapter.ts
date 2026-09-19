import { Effect } from 'effect'

import type { EnvMap, HeaderMap } from '../lib/headers.js'
import { readConfig } from '../lib/config.js'
import { PayloadTooLarge, RequestBodyFailed } from '../lib/errors.js'
import { MAX_HTML_BYTES } from '../lib/html-limits.js'
import { handlePlansRequest } from '../lib/http.js'
import type { PlansRequest, PlansResponse } from '../lib/http.js'
import { withSecurityHeaders } from '../lib/security-headers.js'
import { s3StorageLayer } from '../lib/storage-s3.js'

const textEncoder = new TextEncoder()

function snapshotEnv(): EnvMap {
  const envRecord: EnvMap = {}

  for (const key of Object.keys(process.env)) {
    envRecord[key] = process.env[key]
  }

  return envRecord
}

function requestHeaders(request: Request): HeaderMap {
  const out: HeaderMap = {}

  request.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value
  })

  return out
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  if (request.body === null) {
    return null
  }

  const reader = request.body.getReader()
  const chunks: Array<Uint8Array> = []
  let total = 0
  let reading = true

  try {
    while (reading) {
      const next = await reader.read()

      if (next.done) {
        reading = false
      } else {
        total += next.value.byteLength

        if (total > MAX_HTML_BYTES) {
          try {
            await reader.cancel()
          } catch {
            // Cancel is best-effort; the overflow failure below is authoritative.
          }

          throw new PayloadTooLarge({ limitBytes: MAX_HTML_BYTES })
        }

        chunks.push(next.value)
      }
    }
  } catch (cause) {
    if (cause instanceof PayloadTooLarge) {
      throw cause
    }

    throw new RequestBodyFailed({})
  }

  if (total === 0) {
    return null
  }

  const merged = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

function readRequestBody(
  request: Request
): Effect.Effect<Uint8Array | null, PayloadTooLarge | RequestBodyFailed> {
  return Effect.tryPromise({
    try: () => readBoundedBody(request),
    catch: (cause) => (cause instanceof PayloadTooLarge ? cause : new RequestBodyFailed({}))
  })
}

function toWebResponse(response: PlansResponse): Response {
  const headers = new Headers()

  for (const key of Object.keys(response.headers)) {
    const value = response.headers[key]

    if (value !== undefined) {
      headers.set(key, value)
    }
  }

  if (response.body === null) {
    return new Response(null, { status: response.status, headers })
  }

  return new Response(new Uint8Array(response.body), { status: response.status, headers })
}

function payloadTooLargeResponse(): PlansResponse {
  return {
    status: 413,
    headers: withSecurityHeaders({ 'content-type': 'application/json; charset=utf-8' }),
    body: textEncoder.encode(JSON.stringify({ error: 'payload-too-large' }))
  }
}

function internalError(): Response {
  return new Response('internal error', {
    status: 500,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
  })
}

export function runPlansRequest(request: Request, overrideUrl: string | null): Promise<Response> {
  const program = Effect.gen(function* () {
    const config = yield* readConfig(snapshotEnv())
    const layer = s3StorageLayer(config)
    const body = yield* readRequestBody(request)

    const plansRequest: PlansRequest = {
      method: request.method,
      url: overrideUrl ?? request.url,
      headers: requestHeaders(request),
      body
    }

    return yield* handlePlansRequest(plansRequest, config).pipe(Effect.provide(layer))
  })

  return Effect.runPromise(
    program.pipe(
      Effect.catchTag('PayloadTooLarge', () => Effect.succeed(payloadTooLargeResponse()))
    )
  ).then(
    (response) => toWebResponse(response),
    () => internalError()
  )
}
