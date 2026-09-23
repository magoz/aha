import { createServer } from 'node:http'
import type { Server, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'

import { Effect, Schema } from 'effect'

import type { HeaderMap } from '../lib/headers.js'
import { HTML_CONTENT_TYPE, MAX_HTML_BYTES } from '../lib/html-limits.js'
import { withSecurityHeaders } from '../lib/security-headers.js'
import { PreviewFailure } from './preview-error.js'

export interface PreviewServer {
  readonly url: string
  readonly port: number
  readonly close: Effect.Effect<void, PreviewFailure>
}

interface PreviewResponse {
  readonly status: number
  readonly headers: HeaderMap
  readonly body: Uint8Array | null
}

const AddressSchema = Schema.Struct({ port: Schema.Number })

function notFoundResponse(): PreviewResponse {
  return {
    status: 404,
    headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
    body: new TextEncoder().encode('not found')
  }
}

function buildPreviewResponse(
  file: string,
  method: string,
  target: string
): Effect.Effect<PreviewResponse, never> {
  return Effect.gen(function* () {
    if (method !== 'GET') {
      return notFoundResponse()
    }

    const pathname = yield* Effect.try({
      try: () => new URL(target, 'http://127.0.0.1').pathname,
      catch: () => new PreviewFailure({ message: 'bad request target' })
    }).pipe(Effect.orElseSucceed(() => ''))

    if (pathname !== '/') {
      return notFoundResponse()
    }

    const body = yield* Effect.tryPromise({
      try: () => readFile(file),
      catch: () => new PreviewFailure({ message: `cannot read file: ${file}` })
    }).pipe(Effect.orElseSucceed(() => null))

    if (body === null) {
      return {
        status: 500,
        headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
        body: new TextEncoder().encode('cannot read file')
      }
    }

    if (body.length > MAX_HTML_BYTES) {
      return {
        status: 413,
        headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
        body: new TextEncoder().encode('file too large')
      }
    }

    return {
      status: 200,
      headers: withSecurityHeaders({
        'content-type': HTML_CONTENT_TYPE,
        'content-length': String(body.length)
      }),
      body
    }
  })
}

function writePreviewResponse(res: ServerResponse, response: PreviewResponse): void {
  res.statusCode = response.status

  for (const key of Object.keys(response.headers)) {
    const value = response.headers[key]

    if (value !== undefined) {
      res.setHeader(key, value)
    }
  }

  res.end(response.body === null ? undefined : Buffer.from(response.body))
}

export function startPreviewServer(
  file: string,
  port: number | null
): Effect.Effect<PreviewServer, PreviewFailure> {
  return Effect.gen(function* () {
    const server: Server = createServer((req, res) => {
      const method = req.method ?? 'GET'
      const requestTarget = req.url ?? '/'

      Effect.runPromise(buildPreviewResponse(file, method, requestTarget))
        .then((response) => {
          writePreviewResponse(res, response)
        })
        .catch(() => undefined)
    })

    const listenPort = port ?? 0

    yield* Effect.tryPromise({
      try: () =>
        new Promise<void>((resolve, reject) => {
          server.once('error', reject)
          server.listen(listenPort, '127.0.0.1', () => {
            server.off('error', reject)
            resolve()
          })
        }),
      catch: () =>
        new PreviewFailure({ message: `cannot listen on 127.0.0.1:${String(listenPort)}` })
    })

    const address = yield* Schema.decodeUnknownEffect(AddressSchema)(server.address()).pipe(
      Effect.mapError(() => new PreviewFailure({ message: 'cannot determine preview server port' }))
    )

    const activePort = address.port

    return {
      url: `http://127.0.0.1:${String(activePort)}/`,
      port: activePort,
      close: Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve) => {
            server.closeAllConnections()
            server.close(() => {
              resolve()
            })
          }),
        catch: () => new PreviewFailure({ message: 'cannot close preview server' })
      })
    }
  })
}
