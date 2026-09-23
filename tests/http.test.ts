import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'

import type { HeaderMap } from '../lib/headers.js'
import { handleAhaRequest } from '../lib/http.js'
import type { AhaRequest } from '../lib/http.js'
import {
  TEST_CONFIG,
  bytesToString,
  htmlBytes,
  makeTestContext,
  ownerAuth,
  privateAuth
} from './helpers.js'

const SAMPLE = '<!doctype html><html><body><p>synthetic http</p></body></html>'

function get(url: string, authorization: string | null): AhaRequest {
  const headers: HeaderMap = {}

  if (authorization !== null) {
    headers['authorization'] = authorization
  }

  return { method: 'GET', url, headers, body: null }
}

function postDocument(body: Uint8Array, authorization: string | null): AhaRequest {
  const headers: HeaderMap = { 'content-type': 'text/html' }

  if (authorization !== null) {
    headers['authorization'] = authorization
  }

  return { method: 'POST', url: '/api/documents', headers, body }
}

const CreatedPayload = Schema.Struct({ id: Schema.String, url: Schema.String })

function createdId(payload: string): Effect.Effect<string, never> {
  return Schema.decodeUnknownEffect(CreatedPayload)(JSON.parse(payload)).pipe(
    Effect.map((decoded) => decoded.id),
    Effect.orElseSucceed(() => '')
  )
}

function createdUrl(payload: string): Effect.Effect<string, never> {
  return Schema.decodeUnknownEffect(CreatedPayload)(JSON.parse(payload)).pipe(
    Effect.map((decoded) => decoded.url),
    Effect.orElseSucceed(() => '')
  )
}

function responseText(response: { body: Uint8Array | null }): string {
  if (response.body === null) {
    return ''
  }

  return bytesToString(response.body)
}

describe('http boundary', () => {
  it.effect('serves root and health without ids', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const root = yield* handleAhaRequest(get('/', null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      const health = yield* handleAhaRequest(get('/api/health', null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(root.status).toBe(200)
      expect(health.status).toBe(200)
      expect(responseText(root).includes('aha')).toBe(true)
      expect(responseText(health).includes('true')).toBe(true)
      expect(root.headers['cache-control']).toBe('no-store')
      expect(health.headers['x-content-type-options']).toBe('nosniff')
      expect(health.headers['content-security-policy']?.includes('sandbox')).toBe(true)
    })
  )

  it.effect('enforces marker lifecycle on public reads', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(created.status).toBe(201)

      const id = yield* createdId(responseText(created))
      const shareUrl = yield* createdUrl(responseText(created))

      expect(shareUrl).toBe(`https://aha.oox.sh/${id}`)

      const before = yield* handleAhaRequest(get(`/${id}`, null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(before.status).toBe(404)

      const publish = yield* handleAhaRequest(
        {
          method: 'POST',
          url: `/api/documents/${id}/publish`,
          headers: { authorization: ownerAuth() },
          body: null
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(publish.status).toBe(200)

      const after = yield* handleAhaRequest(get(`/${id}`, null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(after.status).toBe(200)

      const csp = after.headers['content-security-policy'] ?? ''

      expect(csp.includes("style-src 'unsafe-inline'")).toBe(true)
      expect(csp.includes('img-src data:')).toBe(true)
      expect(csp.includes('font-src data:')).toBe(true)
      expect(csp.includes("default-src 'none'")).toBe(true)
      expect(csp.includes("script-src 'unsafe-inline'")).toBe(true)
      expect(csp.includes("script-src-attr 'none'")).toBe(true)
      expect(csp.includes('form-action')).toBe(true)
      expect(csp.includes('connect-src')).toBe(false)
      expect(csp.includes('allow-same-origin')).toBe(false)
      expect(csp.endsWith('sandbox allow-scripts')).toBe(true)
      expect(after.headers['content-type']).toBe('text/html; charset=utf-8')
      expect(after.headers['cache-control']).toBe('no-store')
      expect(after.headers['referrer-policy']).toBe('no-referrer')

      const afterBody = after.body

      expect(afterBody === null).toBe(false)

      if (afterBody !== null) {
        expect(bytesToString(afterBody)).toBe(SAMPLE)
      }

      const unpublish = yield* handleAhaRequest(
        {
          method: 'POST',
          url: `/api/documents/${id}/unpublish`,
          headers: { authorization: ownerAuth() },
          body: null
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(unpublish.status).toBe(200)

      const closed = yield* handleAhaRequest(get(`/${id}`, null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(closed.status).toBe(404)
    })
  )

  it.effect('storage outage denies public reads without leaking', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const id = yield* createdId(responseText(created))

      ctx.state.failAll = true

      const denied = yield* handleAhaRequest(get(`/${id}`, null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(denied.status).toBe(502)
    })
  )

  it.effect('head and conditional requests respect access', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const id = yield* createdId(responseText(created))

      yield* handleAhaRequest(
        {
          method: 'POST',
          url: `/api/documents/${id}/publish`,
          headers: { authorization: ownerAuth() },
          body: null
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const head = yield* handleAhaRequest(
        { method: 'HEAD', url: `/${id}`, headers: {}, body: null },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(head.status).toBe(200)
      expect(head.body).toBe(null)

      const etag = head.headers['etag'] ?? ''

      const notModified = yield* handleAhaRequest(
        { method: 'GET', url: `/${id}`, headers: { 'if-none-match': etag }, body: null },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(notModified.status).toBe(304)

      const ranged = yield* handleAhaRequest(
        { method: 'GET', url: `/${id}`, headers: { range: 'bytes=0-10' }, body: null },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(ranged.status).toBe(200)

      const rangedBody = ranged.body

      expect(rangedBody === null).toBe(false)

      if (rangedBody !== null) {
        expect(bytesToString(rangedBody)).toBe(SAMPLE)
      }

      yield* handleAhaRequest(
        {
          method: 'POST',
          url: `/api/documents/${id}/unpublish`,
          headers: { authorization: ownerAuth() },
          body: null
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const variants: ReadonlyArray<Pick<AhaRequest, 'method' | 'headers'>> = [
        { method: 'GET', headers: {} },
        { method: 'HEAD', headers: {} },
        { method: 'GET', headers: { 'if-none-match': etag } },
        { method: 'HEAD', headers: { 'if-none-match': etag } },
        { method: 'GET', headers: { range: 'bytes=0-10' } }
      ]

      for (const url of [`/${id}`, `/api/documents/${id}`]) {
        for (const variant of variants) {
          const denied = yield* handleAhaRequest(
            { method: variant.method, headers: variant.headers, url, body: null },
            TEST_CONFIG
          ).pipe(Effect.provide(ctx.layer))

          expect(denied.status).toBe(url.startsWith('/api/') ? 401 : 404)
          expect(denied.headers['cache-control']).toBe('no-store')
          expect(responseText(denied)).not.toContain(SAMPLE)
        }

        const privateRead = yield* handleAhaRequest(get(url, privateAuth()), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )

        expect(privateRead.status).toBe(200)
      }
    })
  )

  it.effect('rejects traversal, encodings and invalid ids', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const paths = [
        '/../secret',
        '/%2e%2e/secret',
        '/api//documents',
        '/api/documents/../escape-here-abcdef',
        '/not-an-id',
        '/AAAAAAAAAAAAAAAAAAAAAAA',
        '/api/documents/not-an-id-here-zzzz'
      ]

      for (const path of paths) {
        const response = yield* handleAhaRequest(get(path, ownerAuth()), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )

        expect(response.status === 404 || response.status === 400).toBe(true)
      }

      const hostStyle = yield* handleAhaRequest(get('//other-host', null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(hostStyle.status).toBe(200)
      expect(responseText(hostStyle)).toBe('aha')
    })
  )

  it.effect('enforces upload limits including content-length', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const lying: AhaRequest = {
        method: 'POST',
        url: '/api/documents',
        headers: {
          authorization: ownerAuth(),
          'content-type': 'text/html',
          'content-length': '99999999'
        },
        body: htmlBytes(SAMPLE)
      }

      const rejected = yield* handleAhaRequest(lying, TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      expect(rejected.status).toBe(413)

      const wrongType = yield* handleAhaRequest(
        {
          method: 'POST',
          url: '/api/documents',
          headers: { authorization: ownerAuth(), 'content-type': 'application/json' },
          body: htmlBytes('{}')
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(wrongType.status).toBe(415)

      const missing: AhaRequest = {
        method: 'POST',
        url: '/api/documents',
        headers: { 'content-type': 'text/html' },
        body: htmlBytes(SAMPLE)
      }

      const anonymous = yield* handleAhaRequest(missing, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(anonymous.status).toBe(401)
    })
  )

  it.effect('separates owner, private-read and public capabilities', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const id = yield* createdId(responseText(created))

      const privateRead = yield* handleAhaRequest(
        get(`/api/documents/${id}`, privateAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(privateRead.status).toBe(200)

      const anonymousApi = yield* handleAhaRequest(
        get(`/api/documents/${id}`, null),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(anonymousApi.status).toBe(401)

      const list = yield* handleAhaRequest(get('/api/documents', privateAuth()), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(list.status).toBe(401)

      const ownerList = yield* handleAhaRequest(
        get('/api/documents', ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(ownerList.status).toBe(200)
    })
  )

  it.effect('update keeps visibility and delete stays safe', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const id = yield* createdId(responseText(created))
      const revised = '<!doctype html><html><body><p>v2</p></body></html>'

      yield* handleAhaRequest(
        {
          method: 'POST',
          url: `/api/documents/${id}/publish`,
          headers: { authorization: ownerAuth() },
          body: null
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const updated = yield* handleAhaRequest(
        {
          method: 'PUT',
          url: `/api/documents/${id}`,
          headers: { authorization: ownerAuth(), 'content-type': 'text/html' },
          body: htmlBytes(revised)
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(updated.status).toBe(200)

      const open = yield* handleAhaRequest(get(`/${id}`, null), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(open.status).toBe(200)

      const blocked = yield* handleAhaRequest(
        {
          method: 'DELETE',
          url: `/api/documents/${id}`,
          headers: { authorization: ownerAuth() },
          body: null
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(blocked.status).toBe(409)
    })
  )
})
