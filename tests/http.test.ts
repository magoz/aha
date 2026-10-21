import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'

import type { HeaderMap } from '../lib/headers.js'
import { handleAhaRequest } from '../lib/http.js'
import type { AhaRequest } from '../lib/http.js'
import { SESSION_COOKIE } from '../lib/sessions.js'
import { streamOf } from './fake-storage.js'
import { TEST_CONFIG, htmlBytes, makeTestContext, ownerAuth, responseText } from './helpers.js'
import type { TestContext } from './helpers.js'

const SAMPLE = '<!doctype html><html><body><p>synthetic http</p></body></html>'

function get(url: string, authorization: string | null): AhaRequest {
  const headers: HeaderMap = {}

  if (authorization !== null) {
    headers['authorization'] = authorization
  }

  return { method: 'GET', url, headers, body: null }
}

function withBody(method: string, url: string, headers: HeaderMap, bytes: Uint8Array): AhaRequest {
  return {
    method,
    url,
    headers: { ...headers, 'content-length': String(bytes.length) },
    body: streamOf(bytes)
  }
}

// Pairs a browser through the HTTP routes and returns its cookie header.
function pairBrowser(ctx: TestContext): Effect.Effect<string> {
  return Effect.gen(function* () {
    const created = yield* handleAhaRequest(
      { method: 'POST', url: '/api/pair', headers: { authorization: ownerAuth() }, body: null },
      TEST_CONFIG
    ).pipe(Effect.provide(ctx.layer))

    const pairing = yield* Schema.decodeUnknownEffect(PairingPayload)(
      JSON.parse(yield* responseText(created))
    ).pipe(Effect.orDie)

    const path = new URL(pairing.url).pathname

    const paired = yield* handleAhaRequest(
      { method: 'POST', url: path, headers: { 'user-agent': 'Safari/605 Mac OS X' }, body: null },
      TEST_CONFIG
    ).pipe(Effect.provide(ctx.layer))

    const cookie = (paired.headers['set-cookie'] ?? '').split(';')[0] ?? ''

    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true)

    return cookie
  })
}

function postDocument(
  body: Uint8Array,
  authorization: string | null,
  name: string | null = 'sample-doc'
): AhaRequest {
  const headers: HeaderMap = { 'content-type': 'text/html' }

  if (authorization !== null) {
    headers['authorization'] = authorization
  }

  const url = name === null ? '/api/documents' : `/api/documents?name=${name}`

  return withBody('POST', url, headers, body)
}

const CreatedPayload = Schema.Struct({ id: Schema.String, url: Schema.String })

const PairingPayload = Schema.Struct({ url: Schema.String, expiresAt: Schema.String })

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
      expect((yield* responseText(root)).includes('aha')).toBe(true)
      expect((yield* responseText(health)).includes('true')).toBe(true)
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

      const id = yield* createdId(yield* responseText(created))
      const shareUrl = yield* createdUrl(yield* responseText(created))

      expect(shareUrl).toBe(`https://aha.o-o.co/${id}`)

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

      expect(yield* responseText(after)).toBe(SAMPLE)

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

      const id = yield* createdId(yield* responseText(created))

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

      const id = yield* createdId(yield* responseText(created))

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

      expect(yield* responseText(ranged)).toBe(SAMPLE)

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
          expect(yield* responseText(denied)).not.toContain(SAMPLE)
        }

        const ownerRead = yield* handleAhaRequest(get(url, ownerAuth()), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )

        expect(ownerRead.status).toBe(200)
      }
    })
  )

  it.effect('rejects traversal, encodings and invalid ids', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const paths = [
        '/../secret',
        '/has.dot',
        '/api',
        '/sample-doc.html',
        '/sample-doc/extra',
        `/${'a'.repeat(81)}`,
        '/%2e%2e/secret',
        '/api//documents',
        '/api/documents/../escape-here-abcdef',
        '/api/documents/bad.id',
        '/api/documents/%2e%2e'
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
      expect(yield* responseText(hostStyle)).toBe('aha')
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
        body: streamOf(htmlBytes(SAMPLE))
      }

      const rejected = yield* handleAhaRequest(lying, TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      expect(rejected.status).toBe(413)

      const wrongType = yield* handleAhaRequest(
        {
          method: 'POST',
          url: '/api/documents',
          headers: {
            authorization: ownerAuth(),
            'content-type': 'application/json',
            'content-length': '2'
          },
          body: streamOf(htmlBytes('{}'))
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(wrongType.status).toBe(415)

      const missing: AhaRequest = {
        method: 'POST',
        url: '/api/documents',
        headers: { 'content-type': 'text/html', 'content-length': String(SAMPLE.length) },
        body: streamOf(htmlBytes(SAMPLE))
      }

      const anonymous = yield* handleAhaRequest(missing, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(anonymous.status).toBe(401)

      const unsized = yield* handleAhaRequest(
        {
          method: 'POST',
          url: '/api/documents?name=no-length',
          headers: { authorization: ownerAuth(), 'content-type': 'text/html' },
          body: streamOf(htmlBytes(SAMPLE))
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(unsized.status).toBe(411)
      expect(ctx.state.documents.size).toBe(0)
    })
  )

  it.effect('separates owner, paired browser and public capabilities', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const id = yield* createdId(yield* responseText(created))
      const cookie = yield* pairBrowser(ctx)

      const paired = yield* handleAhaRequest(
        { method: 'GET', url: `/${id}`, headers: { cookie }, body: null },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(paired.status).toBe(200)
      expect(yield* responseText(paired)).toBe(SAMPLE)
      expect(paired.headers['set-cookie']?.startsWith(cookie)).toBe(true)
      expect(paired.headers['cache-control']).toBe('no-store')

      const forged = yield* handleAhaRequest(
        {
          method: 'GET',
          url: `/${id}`,
          headers: { cookie: `${SESSION_COOKIE}=${'x'.repeat(43)}` },
          body: null
        },
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(forged.status).toBe(404)
      expect(forged.headers['set-cookie']).toBe(undefined)

      // The cookie only opens pages: never the API, listing or publishing.
      for (const request of [
        { method: 'GET', url: `/api/documents/${id}` },
        { method: 'GET', url: '/api/documents' },
        { method: 'POST', url: `/api/documents/${id}/publish` },
        { method: 'POST', url: '/api/pair' },
        { method: 'GET', url: '/api/sessions' }
      ]) {
        const denied = yield* handleAhaRequest(
          { ...request, headers: { cookie }, body: null },
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))

        expect(denied.status).toBe(401)
      }

      const anonymousApi = yield* handleAhaRequest(
        get(`/api/documents/${id}`, null),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(anonymousApi.status).toBe(401)

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

      const id = yield* createdId(yield* responseText(created))
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
          headers: {
            authorization: ownerAuth(),
            'content-type': 'text/html',
            'content-length': String(htmlBytes(revised).length)
          },
          body: streamOf(htmlBytes(revised))
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

  it.effect('routes readable names and legacy ids to documents', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      const legacy = 'AbCdEfGhIjKlMnOpQr_-12'

      ctx.state.documents.set(legacy, { body: htmlBytes(SAMPLE), etag: '"legacy"', version: 1 })

      const created = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth(), 'q3-launch-plan'),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(created.status).toBe(201)
      expect(yield* createdId(yield* responseText(created))).toBe('q3-launch-plan')
      expect(yield* createdUrl(yield* responseText(created))).toBe(
        'https://aha.o-o.co/q3-launch-plan'
      )

      for (const id of ['q3-launch-plan', legacy]) {
        const privateBefore = yield* handleAhaRequest(get(`/${id}`, null), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )

        expect(privateBefore.status).toBe(404)

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

        const open = yield* handleAhaRequest(get(`/${id}`, null), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )

        expect(open.status).toBe(200)
        expect(yield* responseText(open)).toBe(SAMPLE)

        const ownerRead = yield* handleAhaRequest(
          get(`/api/documents/${id}`, ownerAuth()),
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))

        expect(ownerRead.status).toBe(200)
      }
    })
  )

  it.effect('rejects taken names with 409 without touching the original', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const first = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), ownerAuth(), 'taken-name'),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(first.status).toBe(201)

      const clash = yield* handleAhaRequest(
        postDocument(htmlBytes('<!doctype html><p>intruder</p>'), ownerAuth(), 'taken-name'),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(clash.status).toBe(409)
      expect(yield* responseText(clash)).toBe(JSON.stringify({ error: 'name-taken' }))

      const read = yield* handleAhaRequest(
        get('/api/documents/taken-name', ownerAuth()),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(yield* responseText(read)).toBe(SAMPLE)
    })
  )

  it.effect('rejects uploads without a valid name with 400', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      const names = [null, '', 'Upper', 'has.dot', '..', '%2e%2e', 'a%2Fb', 'double--dash', 'api']

      for (const name of names) {
        const response = yield* handleAhaRequest(
          postDocument(htmlBytes(SAMPLE), ownerAuth(), name),
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))

        expect(response.status).toBe(400)
        expect(yield* responseText(response)).toBe(JSON.stringify({ error: 'invalid-name' }))
      }

      expect(ctx.state.documents.size).toBe(0)

      const anonymous = yield* handleAhaRequest(
        postDocument(htmlBytes(SAMPLE), null, null),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(anonymous.status).toBe(401)
    })
  )
})
