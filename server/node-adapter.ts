import { createServer } from 'node:http'
import type { IncomingHttpHeaders, Server, ServerResponse } from 'node:http'

import { Effect } from 'effect'

import type { HeaderMap } from '../lib/headers.js'
import { MAX_HTML_BYTES } from '../lib/html-limits.js'
import type { PlansRequest, PlansResponse } from '../lib/http.js'
import { withSecurityHeaders } from '../lib/security-headers.js'

function lowercaseHeaders(raw: IncomingHttpHeaders): HeaderMap {
  const out: HeaderMap = {}

  for (const key of Object.keys(raw)) {
    const value = raw[key]
    const first = Array.isArray(value) ? value[0] : value

    if (first !== undefined) {
      out[key.toLowerCase()] = first
    }
  }

  return out
}

function writeResponse(res: ServerResponse, response: PlansResponse): void {
  res.statusCode = response.status

  for (const key of Object.keys(response.headers)) {
    const value = response.headers[key]

    if (value !== undefined) {
      res.setHeader(key, value)
    }
  }

  res.end(response.body === null ? undefined : Buffer.from(response.body))
}

function writeError(res: ServerResponse, status: number, message: string): void {
  writeResponse(res, {
    status,
    headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
    body: new TextEncoder().encode(message)
  })
}

export function createPlansServer<E>(
  handle: (request: PlansRequest) => Effect.Effect<PlansResponse, E>
): Server {
  const server = createServer((req, res) => {
    const chunks: Array<Uint8Array> = []
    let total = 0
    let finished = false

    req.on('data', (chunk: Uint8Array) => {
      if (finished) {
        return
      }

      total += chunk.byteLength

      if (total > MAX_HTML_BYTES) {
        finished = true
        chunks.length = 0
        req.pause()
        res.setHeader('connection', 'close')
        res.once('finish', () => req.destroy())
        writeError(res, 413, 'payload too large')

        return
      }

      chunks.push(chunk)
    })

    req.on('error', () => {
      if (!finished) {
        finished = true
        chunks.length = 0
        writeError(res, 400, 'request body failed')
      }
    })

    req.on('end', () => {
      if (finished) {
        return
      }

      finished = true

      const request: PlansRequest = {
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        headers: lowercaseHeaders(req.headers),
        body: total === 0 ? null : Buffer.concat(chunks, total)
      }

      Effect.runPromise(Effect.suspend(() => handle(request))).then(
        (response) => writeResponse(res, response),
        () => writeError(res, 500, 'internal error')
      )
    })
  })

  server.requestTimeout = 30000

  return server
}
