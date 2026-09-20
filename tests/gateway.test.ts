import { createServer } from 'node:http'
import type { Server } from 'node:http'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Effect, Schema } from 'effect'

import { startPrivateGateway } from '../gateway/gateway-server.js'

const DOC_ID = 'AAAAAAAAAAAAAAAAAAAAAA'

const REDIRECT_ID = 'BBBBBBBBBBBBBBBBBBBBBB'

const NOT_MODIFIED_ID = 'CCCCCCCCCCCCCCCCCCCCCC'

const UPSTREAM_TOKEN = 'gateway-test-private-token'

const AddressSchema = Schema.Struct({ port: Schema.Number })

function singleHeader(value: string | Array<string> | undefined): string {
  if (value === undefined) {
    return ''
  }

  if (Array.isArray(value)) {
    const first = value[0]

    if (first === undefined) {
      return ''
    }

    return first
  }

  return value
}

interface SeenRequest {
  url: string
  authorization: string
  cookie: string
  forwarded: string
}

function getPort(server: Server): Promise<number> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeUnknownEffect(AddressSchema)(server.address()).pipe(
        Effect.orElseSucceed(() => ({ port: -1 }))
      )

      if (decoded.port < 0) {
        return yield* Effect.fail(new Error('no address'))
      }

      return decoded.port
    })
  )
}

function listenEphemeral(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      getPort(server).then(resolve, reject)
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve()
    })
  })
}

describe('private gateway', () => {
  let upstream: Server | null = null
  let gateway: Server | null = null
  let seen: Array<SeenRequest> = []
  let gatewayPort = 0

  beforeEach(async () => {
    seen = []
    upstream = createServer((req, res) => {
      seen.push({
        url: req.url ?? '',
        authorization: singleHeader(req.headers['authorization']),
        cookie: singleHeader(req.headers['cookie']),
        forwarded: singleHeader(req.headers['x-forwarded-for'])
      })

      if (req.url === `/${REDIRECT_ID}`) {
        res.statusCode = 302
        res.setHeader('location', `/${DOC_ID}`)
        res.end()

        return
      }

      if (req.url === `/${NOT_MODIFIED_ID}`) {
        res.statusCode = 304
        res.setHeader('etag', '"upstream-1"')
        res.end()

        return
      }

      if (req.headers['authorization'] !== `Bearer ${UPSTREAM_TOKEN}`) {
        res.statusCode = 401
        res.end('unauthorized')

        return
      }

      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('etag', '"upstream-1"')
      res.end('<!doctype html><html><body><p>private</p></body></html>')
    })
    const upstreamPort = await listenEphemeral(upstream)
    process.env['AHA_UPSTREAM_URL'] = `http://127.0.0.1:${String(upstreamPort)}`
    process.env['AHA_GATEWAY_INSECURE_LOOPBACK'] = '1'
    process.env['AHA_PRIVATE_READ_TOKEN'] = UPSTREAM_TOKEN
    gateway = startPrivateGateway(0)
    await new Promise<void>((resolve, reject) => {
      gateway?.once('error', reject)
      gateway?.once('listening', () => {
        resolve()
      })
    })
    gatewayPort = await getPort(gateway)
  })

  afterEach(async () => {
    if (gateway !== null) {
      await closeServer(gateway)
      gateway = null
    }

    if (upstream !== null) {
      await closeServer(upstream)
      upstream = null
    }

    delete process.env['AHA_UPSTREAM_URL']
    delete process.env['AHA_GATEWAY_INSECURE_LOOPBACK']
    delete process.env['AHA_PRIVATE_READ_TOKEN']
  })

  it('proxies private reads while stripping client credentials', async () => {
    const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/${DOC_ID}`, {
      headers: {
        authorization: 'Bearer evil-client-token',
        cookie: 'session=evil',
        'x-forwarded-for': '1.2.3.4'
      }
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body.includes('private')).toBe(true)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(seen.length).toBe(1)

    const first = seen[0]

    expect(first?.authorization).toBe(`Bearer ${UPSTREAM_TOKEN}`)
    expect(first?.cookie).toBe('')
    expect(first?.forwarded).toBe('')
  })

  it('refuses upstream redirects instead of following with the credential', async () => {
    const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/${REDIRECT_ID}`)
    await response.text()

    expect(response.status).toBe(502)
    expect(seen.length).toBe(1)
  })

  it('forwards upstream 304 instead of refusing it as a redirect', async () => {
    const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/${NOT_MODIFIED_ID}`, {
      headers: { 'if-none-match': '"upstream-1"' }
    })

    await response.text()

    expect(response.status).toBe(304)
    expect(response.headers.get('etag')).toBe('"upstream-1"')
  })

  it('rejects mutations and api paths without contacting upstream', async () => {
    const before = seen.length

    const post = await fetch(`http://127.0.0.1:${String(gatewayPort)}/${DOC_ID}`, {
      method: 'POST'
    })

    await post.text()

    expect(post.status).toBe(404)

    const api = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/documents`)
    await api.text()

    expect(api.status).toBe(404)
    expect(seen.length).toBe(before)
  })
})
