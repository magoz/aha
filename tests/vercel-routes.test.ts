import { afterEach, describe, expect, it } from 'vitest'

import documentRoute from '../api/documents/[id].js'
import publishRoute from '../api/documents/[id]/publish.js'
import unpublishRoute from '../api/documents/[id]/unpublish.js'
import documentsRoute from '../api/documents.js'
import healthRoute from '../api/health.js'
import publicDocumentRoute from '../api/public-document.js'
import rootRoute from '../api/root.js'
import { TEST_CONFIG, ownerAuth } from './helpers.js'

const VALID_ID = 'AAAAAAAAAAAAAAAAAAAAAA'

const ENV_KEYS = [
  'PLANS_OWNER_TOKEN',
  'PLANS_PRIVATE_READ_TOKEN',
  'R2_BUCKET',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY'
]

function setRefusedStorageEnv(): void {
  process.env['PLANS_OWNER_TOKEN'] = TEST_CONFIG.ownerToken
  process.env['PLANS_PRIVATE_READ_TOKEN'] = TEST_CONFIG.privateReadToken
  process.env['R2_BUCKET'] = TEST_CONFIG.bucket
  process.env['R2_ENDPOINT'] = 'http://127.0.0.1:1'
  process.env['R2_ACCESS_KEY_ID'] = TEST_CONFIG.accessKeyId
  process.env['R2_SECRET_ACCESS_KEY'] = TEST_CONFIG.secretAccessKey
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
})

function authed(url: string, method: string): Request {
  return new Request(url, { method, headers: { authorization: ownerAuth() } })
}

describe('vercel route files', () => {
  it('serves root and health through their direct aliases', async () => {
    setRefusedStorageEnv()

    const root = await rootRoute.fetch(new Request('https://plans.oox.sh/'))
    const health = await healthRoute.fetch(new Request('https://plans.oox.sh/api/health'))

    expect(root.status).toBe(200)
    expect(await root.text()).toBe('plans')
    expect(health.status).toBe(200)
    expect(await health.text()).toBe(JSON.stringify({ ok: true }))
  })

  it('gates the documents collection on the direct alias', async () => {
    setRefusedStorageEnv()

    const anonymous = await documentsRoute.fetch(new Request('https://plans.oox.sh/api/documents'))

    expect(anonymous.status).toBe(401)
  })

  it('fails closed on the direct document alias when storage is down', async () => {
    setRefusedStorageEnv()

    const anonymous = await documentRoute.fetch(
      new Request(`https://plans.oox.sh/api/documents/${VALID_ID}`)
    )

    expect(anonymous.status).toBe(502)
    expect(await anonymous.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  })

  it('routes authed nested document reads past auth to storage', async () => {
    setRefusedStorageEnv()

    const response = await documentRoute.fetch(
      authed(`https://plans.oox.sh/api/documents/${VALID_ID}`, 'GET')
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  }, 15000)

  it('routes authed nested publish past auth to storage', async () => {
    setRefusedStorageEnv()

    const response = await publishRoute.fetch(
      authed(`https://plans.oox.sh/api/documents/${VALID_ID}/publish`, 'POST')
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  }, 15000)

  it('rejects wrong methods and bad ids without storage', async () => {
    setRefusedStorageEnv()

    const method = await publishRoute.fetch(
      authed(`https://plans.oox.sh/api/documents/${VALID_ID}/publish`, 'GET')
    )

    expect(method.status).toBe(405)

    const badId = await documentRoute.fetch(
      authed('https://plans.oox.sh/api/documents/not-an-id', 'GET')
    )

    expect(badId.status).toBe(400)

    const anonymousUnpublish = await unpublishRoute.fetch(
      new Request(`https://plans.oox.sh/api/documents/${VALID_ID}/unpublish`, { method: 'POST' })
    )

    expect(anonymousUnpublish.status).toBe(401)
  })

  it('checks the marker for the rewritten public-document url', async () => {
    setRefusedStorageEnv()

    const response = await publicDocumentRoute.fetch(
      new Request(`https://plans.oox.sh/api/public-document?id=${VALID_ID}`)
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  }, 15000)

  it('returns 404 for the rewritten public-document url without an id', async () => {
    setRefusedStorageEnv()

    const response = await publicDocumentRoute.fetch(
      new Request('https://plans.oox.sh/api/public-document')
    )

    expect(response.status).toBe(404)
  })
})
