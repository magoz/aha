import { afterEach, describe, expect, it } from 'vitest'

import { runPlansRequest } from '../server/vercel-adapter.js'
import { TEST_CONFIG, ownerAuth } from './helpers.js'

interface StreamRequestInit extends RequestInit {
  readonly duplex: 'half'
}

const ENV_KEYS = [
  'PLANS_OWNER_TOKEN',
  'PLANS_PRIVATE_READ_TOKEN',
  'R2_BUCKET',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY'
]

function setServiceEnv(): void {
  process.env['PLANS_OWNER_TOKEN'] = TEST_CONFIG.ownerToken
  process.env['PLANS_PRIVATE_READ_TOKEN'] = TEST_CONFIG.privateReadToken
  process.env['R2_BUCKET'] = TEST_CONFIG.bucket
  process.env['R2_ENDPOINT'] = TEST_CONFIG.endpoint
  process.env['R2_ACCESS_KEY_ID'] = TEST_CONFIG.accessKeyId
  process.env['R2_SECRET_ACCESS_KEY'] = TEST_CONFIG.secretAccessKey
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
})

describe('vercel web adapter', () => {
  it('answers health checks as a web Response without storage', async () => {
    setServiceEnv()

    const response = await runPlansRequest(new Request('https://plans.oox.sh/api/health'), null)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe(JSON.stringify({ ok: true }))
  })

  it('fails closed with a generic 500 when config is missing', async () => {
    const response = await runPlansRequest(new Request('https://plans.oox.sh/api/health'), null)

    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe('internal error')
  })

  it('rejects streamed bodies over the limit with 413', async () => {
    setServiceEnv()

    const chunk = new Uint8Array(1024 * 1024)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk)
        controller.enqueue(chunk)
        controller.enqueue(chunk)
        controller.close()
      }
    })

    const init: StreamRequestInit = {
      method: 'POST',
      headers: { authorization: ownerAuth(), 'content-type': 'text/html' },
      body: stream,
      duplex: 'half'
    }

    const request = new Request('https://plans.oox.sh/api/documents', init)
    const response = await runPlansRequest(request, null)

    expect(response.status).toBe(413)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe(JSON.stringify({ error: 'payload-too-large' }))
  })

  it('treats body stream errors as failures, not empty input', async () => {
    setServiceEnv()

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('boom'))
      }
    })

    const init: StreamRequestInit = {
      method: 'POST',
      body: stream,
      duplex: 'half'
    }

    const request = new Request('https://plans.oox.sh/api/health', init)
    const response = await runPlansRequest(request, null)

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('internal error')
  })
})
