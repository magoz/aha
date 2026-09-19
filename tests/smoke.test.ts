import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'

import type { HeaderMap } from '../lib/headers.js'
import { handlePlansRequest } from '../lib/http.js'
import type { PlansResponse } from '../lib/http.js'
import { TEST_CONFIG, htmlBytes, makeTestContext, ownerAuth } from './helpers.js'
import type { TestContext } from './helpers.js'

const SAMPLE = '<!doctype html><html><body><p>smoke lifecycle</p></body></html>'

const AddressSchema = Schema.Struct({ port: Schema.Number })

const CreatedPayload = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  etag: Schema.String
})

function lowercaseHeaders(req: IncomingMessage): HeaderMap {
  const out: HeaderMap = {}
  const raw = req.headers

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

function writeResponse(res: ServerResponse, response: PlansResponse): void {
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
}

function createTestServer(ctx: TestContext): Server {
  return createServer((req, res) => {
    const chunks: Array<Uint8Array> = []

    req.on('data', (chunk: Uint8Array) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      let total = 0

      for (const chunk of chunks) {
        total += chunk.length
      }

      const body = total === 0 ? null : Buffer.concat(chunks)

      const program = Effect.gen(function* () {
        return yield* handlePlansRequest(
          {
            method: req.method ?? 'GET',
            url: req.url ?? '/',
            headers: lowercaseHeaders(req),
            body
          },
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))
      })

      Effect.runPromise(program).then(
        (response) => {
          writeResponse(res, response)
        },
        () => {
          res.statusCode = 500
          res.end('internal error')
        }
      )
    })
  })
}

function listenTestServer(server: Server): Effect.Effect<number, Error> {
  return Effect.tryPromise({
    try: () =>
      new Promise<number>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
          Effect.runPromise(
            Schema.decodeUnknownEffect(AddressSchema)(server.address()).pipe(
              Effect.map((decoded) => decoded.port),
              Effect.orElseSucceed(() => -1)
            )
          ).then((found) => {
            if (found < 0) {
              reject(new Error('no address'))
            } else {
              resolve(found)
            }
          }, reject)
        })
      }),
    catch: () => new Error('listen failed')
  })
}

function closeTestServer(server: Server): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      }),
    catch: () => new Error('close failed')
  })
}

function fetchText(url: string, init: RequestInit): Effect.Effect<string, Error> {
  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, init),
      catch: () => new Error(`request failed: ${url}`)
    })

    return yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => new Error(`body failed: ${url}`)
    })
  })
}

function fetchStatus(url: string, init: RequestInit): Effect.Effect<number, Error> {
  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, init),
      catch: () => new Error(`request failed: ${url}`)
    })

    yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => new Error(`drain failed: ${url}`)
    })

    return response.status
  })
}

function runLifecycle(port: number): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    const base = `http://127.0.0.1:${String(port)}`
    const auth = { authorization: ownerAuth() }

    const uploadStatus = yield* fetchStatus(`${base}/api/documents`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'text/html' },
      body: Buffer.from(htmlBytes(SAMPLE))
    })

    expect(uploadStatus).toBe(201)

    const createdText = yield* fetchText(`${base}/api/documents`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'text/html' },
      body: Buffer.from(htmlBytes(SAMPLE))
    })

    const created = yield* Schema.decodeUnknownEffect(CreatedPayload)(JSON.parse(createdText)).pipe(
      Effect.orElseSucceed(() => ({ id: '', url: '', etag: '' }))
    )

    expect(created.id.length).toBe(22)

    const before = yield* fetchStatus(`${base}/${created.id}`, {})

    expect(before).toBe(404)

    const published = yield* fetchStatus(`${base}/api/documents/${created.id}/publish`, {
      method: 'POST',
      headers: auth
    })

    expect(published).toBe(200)

    const openText = yield* fetchText(`${base}/${created.id}`, {})

    expect(openText).toBe(SAMPLE)

    const revised = '<!doctype html><html><body><p>smoke v2</p></body></html>'

    const updated = yield* fetchStatus(`${base}/api/documents/${created.id}`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'text/html' },
      body: Buffer.from(htmlBytes(revised))
    })

    expect(updated).toBe(200)

    const stillOpen = yield* fetchStatus(`${base}/${created.id}`, {})

    expect(stillOpen).toBe(200)

    const unpublished = yield* fetchStatus(`${base}/api/documents/${created.id}/unpublish`, {
      method: 'POST',
      headers: auth
    })

    expect(unpublished).toBe(200)

    const removed = yield* fetchStatus(`${base}/api/documents/${created.id}`, {
      method: 'DELETE',
      headers: auth
    })

    expect(removed).toBe(200)
  })
}

describe('node http smoke lifecycle', () => {
  it.effect(
    'upload, publish, read, update, unpublish and delete over real http',
    () =>
      Effect.gen(function* () {
        const ctx = makeTestContext()
        const server = createTestServer(ctx)

        return yield* Effect.acquireUseRelease(
          listenTestServer(server),
          (port) => runLifecycle(port),
          () => closeTestServer(server)
        )
      }),
    15000
  )
})
