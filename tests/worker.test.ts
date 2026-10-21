import { Effect, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { SECURITY_HEADERS } from '../lib/security-headers.js'
import { SESSION_COOKIE } from '../lib/sessions.js'
import { handleWorkerRequest } from '../server/worker.js'
import type { WorkerEnv } from '../server/worker.js'
import { countingLengthGuard, createFakeR2Bucket } from './fake-r2-bucket.js'
import type { FakeR2Bucket } from './fake-r2-bucket.js'
import { TEST_OWNER_TOKEN } from './helpers.js'

const SAMPLE = '<!doctype html><html><body><p>synthetic worker page</p></body></html>'

const ORIGIN = 'https://aha.o-o.co'

const owner = { authorization: `Bearer ${TEST_OWNER_TOKEN}` }

const UrlPayload = Schema.Struct({ url: Schema.String })

const EtagPayload = Schema.Struct({ etag: Schema.String })

const SessionsPayload = Schema.Array(Schema.Struct({ id: Schema.String, label: Schema.String }))

const ListPayload = Schema.Array(Schema.Struct({ id: Schema.String, isPublic: Schema.Boolean }))

async function decode<A>(response: Response, schema: Schema.Codec<A>): Promise<A> {
  const payload: unknown = await response.json()

  return Effect.runPromise(Schema.decodeUnknownEffect(schema)(payload))
}

function envFor(bucket: FakeR2Bucket): WorkerEnv {
  return { AHA_BUCKET: bucket, AHA_OWNER_TOKEN: TEST_OWNER_TOKEN }
}

function call(
  env: WorkerEnv,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body: string | null = null
): Promise<Response> {
  const init: RequestInit = { method, headers }

  if (body !== null) {
    init.body = body
  }

  return handleWorkerRequest(new Request(`${ORIGIN}${path}`, init), env, countingLengthGuard)
}

function upload(env: WorkerEnv, name: string, html: string): Promise<Response> {
  return call(
    env,
    'POST',
    `/api/documents?name=${name}`,
    { ...owner, 'content-type': 'text/html', 'content-length': String(html.length) },
    html
  )
}

async function pair(env: WorkerEnv, userAgent: string): Promise<string> {
  const created = await call(env, 'POST', '/api/pair', owner)
  const { url } = await decode(created, UrlPayload)
  const paired = await call(env, 'POST', new URL(url).pathname, { 'user-agent': userAgent })

  return (paired.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}

describe('worker', () => {
  it('runs the full page lifecycle against the R2 binding', async () => {
    const bucket = createFakeR2Bucket()
    const env = envFor(bucket)

    const created = await upload(env, 'worker-page', SAMPLE)
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ id: 'worker-page', url: `${ORIGIN}/worker-page` })

    expect((await call(env, 'GET', '/worker-page')).status).toBe(404)
    expect(await (await call(env, 'GET', '/api/documents/worker-page', owner)).text()).toBe(SAMPLE)

    const cookie = await pair(env, 'Mozilla/5.0 (Macintosh; Mac OS X) Chrome/140 Safari/537')
    const paired = await call(env, 'GET', '/worker-page', { cookie })
    expect(paired.status).toBe(200)
    expect(await paired.text()).toBe(SAMPLE)
    expect(paired.headers.get('set-cookie')).toContain('HttpOnly')

    expect((await call(env, 'POST', '/api/documents/worker-page/publish', owner)).status).toBe(200)

    const open = await call(env, 'GET', '/worker-page')
    expect(open.status).toBe(200)
    expect(await open.text()).toBe(SAMPLE)
    expect(open.headers.get('content-security-policy')).toBe(
      SECURITY_HEADERS['content-security-policy']
    )
    expect(open.headers.get('cache-control')).toBe('no-store')
    expect(open.headers.get('set-cookie')).toBe(null)

    const head = await call(env, 'HEAD', '/worker-page')
    expect(head.status).toBe(200)
    expect(head.headers.get('content-length')).toBe(String(SAMPLE.length))
    const etag = head.headers.get('etag') ?? ''
    expect((await call(env, 'GET', '/worker-page', { 'if-none-match': etag })).status).toBe(304)

    expect((await call(env, 'POST', '/api/documents/worker-page/unpublish', owner)).status).toBe(
      200
    )
    expect((await call(env, 'GET', '/worker-page')).status).toBe(404)

    const sessions = await decode(await call(env, 'GET', '/api/sessions', owner), SessionsPayload)
    expect(sessions.map((session) => session.label)).toEqual(['Chrome on macOS'])

    const revoked = await call(env, 'DELETE', `/api/sessions/${sessions[0]?.id ?? ''}`, owner)
    expect(revoked.status).toBe(200)
    expect((await call(env, 'GET', '/worker-page', { cookie })).status).toBe(404)
  })

  it('never overwrites a taken name, even through the binding', async () => {
    const bucket = createFakeR2Bucket()
    const env = envFor(bucket)

    expect((await upload(env, 'taken', SAMPLE)).status).toBe(201)
    const clash = await upload(env, 'taken', '<!doctype html><p>intruder</p>')
    expect(clash.status).toBe(409)
    expect(await (await call(env, 'GET', '/api/documents/taken', owner)).text()).toBe(SAMPLE)
  })

  it('updates with If-Match and keeps visibility', async () => {
    const bucket = createFakeR2Bucket()
    const env = envFor(bucket)
    const created = await decode(await upload(env, 'versioned', SAMPLE), EtagPayload)
    await call(env, 'POST', '/api/documents/versioned/publish', owner)

    const revised = '<!doctype html><p>v2</p>'

    const headers = {
      ...owner,
      'content-type': 'text/html',
      'content-length': String(revised.length)
    }

    const stale = await call(
      env,
      'PUT',
      '/api/documents/versioned',
      { ...headers, 'if-match': '"nope"' },
      revised
    )

    expect(stale.status).toBe(412)

    const fresh = await call(
      env,
      'PUT',
      '/api/documents/versioned',
      { ...headers, 'if-match': created.etag },
      revised
    )

    expect(fresh.status).toBe(200)
    expect(await (await call(env, 'GET', '/versioned')).text()).toBe(revised)
  })

  it('stores nothing when the body differs from its declared length', async () => {
    const bucket = createFakeR2Bucket()
    const env = envFor(bucket)

    const lying = await handleWorkerRequest(
      new Request(`${ORIGIN}/api/documents?name=lying`, {
        method: 'POST',
        headers: { ...owner, 'content-type': 'text/html', 'content-length': '5' },
        body: SAMPLE
      }),
      env,
      (body) => countingLengthGuard(body, 5)
    )

    expect(lying.status).toBe(502)
    expect(bucket.objects.has('aha/lying.html')).toBe(false)
  })

  it('lists every page across listing pages', async () => {
    const bucket = createFakeR2Bucket()
    const env = envFor(bucket)

    for (const name of ['one', 'two', 'three', 'four', 'five']) {
      await upload(env, name, SAMPLE)
    }

    await call(env, 'POST', '/api/documents/three/publish', owner)
    const all = await decode(await call(env, 'GET', '/api/documents', owner), ListPayload)

    expect(all.map((entry) => entry.id).sort()).toEqual(['five', 'four', 'one', 'three', 'two'])
    expect(all.filter((entry) => entry.isPublic).map((entry) => entry.id)).toEqual(['three'])
  })

  it('uses each pairing link once', async () => {
    const env = envFor(createFakeR2Bucket())
    const created = await call(env, 'POST', '/api/pair', owner)
    const path = new URL((await decode(created, UrlPayload)).url).pathname

    const preview = await call(env, 'GET', path)
    expect(preview.status).toBe(200)
    expect(preview.headers.get('set-cookie')).toBe(null)
    expect(preview.headers.get('content-security-policy')).toContain("form-action 'self'")

    const first = await call(env, 'POST', path)
    expect(first.headers.get('set-cookie')?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)
    expect(first.headers.get('set-cookie')).toContain('SameSite=Lax')

    const second = await call(env, 'POST', path)
    expect(second.status).toBe(410)
    expect(second.headers.get('set-cookie')).toBe(null)

    expect((await call(env, 'POST', '/pair/not-a-real-code')).status).toBe(410)
    expect((await call(env, 'POST', '/api/pair')).status).toBe(401)
  })

  it('fails closed on storage outages and missing config', async () => {
    const bucket = createFakeR2Bucket()
    const env = envFor(bucket)
    await upload(env, 'outage', SAMPLE)
    await call(env, 'POST', '/api/documents/outage/publish', owner)
    bucket.failAll = true

    const denied = await call(env, 'GET', '/outage')
    expect(denied.status).toBe(502)
    expect(await denied.text()).not.toContain('synthetic')

    const misconfigured = await handleWorkerRequest(
      new Request(`${ORIGIN}/api/health`),
      { AHA_BUCKET: bucket },
      countingLengthGuard
    )

    expect(misconfigured.status).toBe(500)
  })
})
