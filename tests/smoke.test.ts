import { request as httpRequest } from 'node:http'
import type { Server } from 'node:http'

import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'

import { MAX_HTML_BYTES } from '../lib/html-limits.js'
import { handlePlansRequest } from '../lib/http.js'
import { createPlansServer } from '../server/node-adapter.js'
import { TEST_CONFIG, htmlBytes, makeTestContext, ownerAuth } from './helpers.js'
import type { TestContext } from './helpers.js'

const SAMPLE = '<!doctype html><html><body><p>smoke lifecycle</p></body></html>'

const AddressSchema = Schema.Struct({ port: Schema.Number })

const CreatedPayload = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  etag: Schema.String
})

function createTestServer(ctx: TestContext): Server {
  return createPlansServer((request) =>
    handlePlansRequest(request, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
  )
}

function oversizedChunkedRequest(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      `http://127.0.0.1:${String(port)}/api/documents`,
      { method: 'POST', headers: { 'content-type': 'text/html' } },
      (response) => {
        expect(response.headers['cache-control']).toBe('no-store')
        response.resume()
        response.on('end', () => {
          resolve(response.statusCode ?? 0)
          request.destroy()
        })
      }
    )

    request.on('error', reject)
    request.setTimeout(5000, () => request.destroy(new Error('no early overflow response')))
    request.write(Buffer.alloc(MAX_HTML_BYTES + 1, 65))
    // Intentionally never end the request: overflow must fail before end-of-stream.
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
  it.effect('rejects an unfinished oversized upload in the actual Node adapter', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      const server = createTestServer(ctx)
      const port = yield* listenTestServer(server)

      yield* Effect.tryPromise(() => oversizedChunkedRequest(port)).pipe(
        Effect.tap((status) => Effect.sync(() => expect(status).toBe(413))),
        Effect.ensuring(closeTestServer(server).pipe(Effect.orDie))
      )
    })
  )

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
