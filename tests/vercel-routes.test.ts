import { readFileSync } from 'node:fs'

import { Option, Schema } from 'effect'
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

const VercelConfigSchema = Schema.Struct({
  rewrites: Schema.Array(Schema.Struct({ source: Schema.String, destination: Schema.String }))
})

function publicDocumentRewrite(): RegExp | null {
  const decoded = Schema.decodeUnknownOption(VercelConfigSchema)(
    JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  )

  if (Option.isNone(decoded)) {
    return null
  }

  const rewrite = decoded.value.rewrites.find(
    (entry) => entry.destination === '/api/public-document?id=:id'
  )

  const match = rewrite === undefined ? null : /^\/:id\((.+)\)$/.exec(rewrite.source)
  const pattern = match?.[1]

  return pattern === undefined ? null : new RegExp(`^/${pattern}$`)
}

const ENV_KEYS = [
  'AHA_OWNER_TOKEN',
  'AHA_PRIVATE_READ_TOKEN',
  'R2_BUCKET',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY'
]

function setRefusedStorageEnv(): void {
  process.env['AHA_OWNER_TOKEN'] = TEST_CONFIG.ownerToken
  process.env['AHA_PRIVATE_READ_TOKEN'] = TEST_CONFIG.privateReadToken
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

    const root = await rootRoute.fetch(new Request('https://aha.oox.sh/'))
    const health = await healthRoute.fetch(new Request('https://aha.oox.sh/api/health'))

    expect(root.status).toBe(200)
    expect(await root.text()).toBe('aha')
    expect(health.status).toBe(200)
    expect(await health.text()).toBe(JSON.stringify({ ok: true }))
  })

  it('gates the documents collection on the direct alias', async () => {
    setRefusedStorageEnv()

    const anonymous = await documentsRoute.fetch(new Request('https://aha.oox.sh/api/documents'))

    expect(anonymous.status).toBe(401)
  })

  it('fails closed on the direct document alias when storage is down', async () => {
    setRefusedStorageEnv()

    const anonymous = await documentRoute.fetch(
      new Request(`https://aha.oox.sh/api/documents/${VALID_ID}`)
    )

    expect(anonymous.status).toBe(502)
    expect(await anonymous.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  })

  it('routes authed nested document reads past auth to storage', async () => {
    setRefusedStorageEnv()

    const response = await documentRoute.fetch(
      authed(`https://aha.oox.sh/api/documents/${VALID_ID}`, 'GET')
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  }, 15000)

  it('routes authed nested publish past auth to storage', async () => {
    setRefusedStorageEnv()

    const response = await publishRoute.fetch(
      authed(`https://aha.oox.sh/api/documents/${VALID_ID}/publish`, 'POST')
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  }, 15000)

  it('rejects wrong methods and bad ids without storage', async () => {
    setRefusedStorageEnv()

    const method = await publishRoute.fetch(
      authed(`https://aha.oox.sh/api/documents/${VALID_ID}/publish`, 'GET')
    )

    expect(method.status).toBe(405)

    const badId = await documentRoute.fetch(
      authed('https://aha.oox.sh/api/documents/not.an.id', 'GET')
    )

    expect(badId.status).toBe(400)

    const anonymousUnpublish = await unpublishRoute.fetch(
      new Request(`https://aha.oox.sh/api/documents/${VALID_ID}/unpublish`, { method: 'POST' })
    )

    expect(anonymousUnpublish.status).toBe(401)
  })

  it('checks the marker for the rewritten public-document url', async () => {
    setRefusedStorageEnv()

    const response = await publicDocumentRoute.fetch(
      new Request(`https://aha.oox.sh/api/public-document?id=${VALID_ID}`)
    )

    expect(response.status).toBe(502)
    expect(await response.text()).toBe(JSON.stringify({ error: 'storage-unavailable' }))
  }, 15000)

  it('returns 404 for the rewritten public-document url without an id', async () => {
    setRefusedStorageEnv()

    const response = await publicDocumentRoute.fetch(
      new Request('https://aha.oox.sh/api/public-document')
    )

    expect(response.status).toBe(404)
  })

  it('rewrites single-segment readable names and legacy ids, nothing else', () => {
    const rewrite = publicDocumentRewrite()

    expect(rewrite).not.toBe(null)

    if (rewrite === null) {
      return
    }

    for (const path of ['/q3-launch-plan', `/${VALID_ID}`, '/a', `/${'a'.repeat(80)}`]) {
      expect(rewrite.test(path)).toBe(true)
    }

    for (const path of [
      '/',
      '/api/health',
      '/api/documents',
      '/api/documents/q3-launch-plan',
      '/q3-launch-plan/extra',
      '/has.dot',
      '/%2e%2e',
      `/${'a'.repeat(81)}`
    ]) {
      expect(rewrite.test(path)).toBe(false)
    }
  })

  it('serves readable names through the rewritten public-document url', async () => {
    setRefusedStorageEnv()

    const response = await publicDocumentRoute.fetch(
      new Request('https://aha.oox.sh/api/public-document?id=q3-launch-plan')
    )

    expect(response.status).toBe(502)
  }, 15000)

  it('never treats the reserved api segment as a document', async () => {
    setRefusedStorageEnv()

    const response = await publicDocumentRoute.fetch(
      new Request('https://aha.oox.sh/api/public-document?id=api')
    )

    expect(response.status).toBe(404)
  })
})
