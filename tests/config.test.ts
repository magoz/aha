import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import type { EnvMap, HeaderMap } from '../lib/headers.js'
import { readConfig } from '../lib/config.js'

function envWith(overrides: HeaderMap): EnvMap {
  return {
    AHA_OWNER_TOKEN: 'owner-token',
    AHA_PRIVATE_READ_TOKEN: 'private-token',
    R2_BUCKET: 'aha-dev',
    R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    R2_ACCESS_KEY_ID: 'key-id',
    R2_SECRET_ACCESS_KEY: 'secret',
    ...overrides
  }
}

describe('config', () => {
  it.effect('reads complete config', () =>
    Effect.gen(function* () {
      const config = yield* readConfig(envWith({}))

      expect(config.bucket).toBe('aha-dev')
      expect(config.region).toBe('auto')
      expect(config.publicUrl).toBe('https://aha.oox.sh')
    })
  )

  it.effect('reads and validates the canonical public url', () =>
    Effect.gen(function* () {
      const custom = yield* readConfig(
        envWith({ AHA_PUBLIC_URL: 'https://cdn.example.com/share/' })
      )

      expect(custom.publicUrl).toBe('https://cdn.example.com/share')

      const invalid = yield* Effect.flip(readConfig(envWith({ AHA_PUBLIC_URL: 'ftp://x' })))

      expect(Predicate.isTagged(invalid, 'InvalidConfig')).toBe(true)
    })
  )

  it.effect('rejects missing owner token', () =>
    Effect.gen(function* () {
      const env = envWith({})
      delete env['AHA_OWNER_TOKEN']
      const failure = yield* Effect.flip(readConfig(env))

      expect(Predicate.isTagged(failure, 'InvalidConfig')).toBe(true)
    })
  )

  it.effect('rejects identical owner and private-read tokens', () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        readConfig(envWith({ AHA_PRIVATE_READ_TOKEN: 'owner-token' }))
      )

      expect(Predicate.isTagged(failure, 'InvalidConfig')).toBe(true)
    })
  )

  it.effect('rejects missing bucket and endpoint', () =>
    Effect.gen(function* () {
      const withoutBucket = envWith({})
      delete withoutBucket['R2_BUCKET']
      const first = yield* Effect.flip(readConfig(withoutBucket))

      expect(Predicate.isTagged(first, 'InvalidConfig')).toBe(true)

      const withoutEndpoint = envWith({})
      delete withoutEndpoint['R2_ENDPOINT']
      const second = yield* Effect.flip(readConfig(withoutEndpoint))

      expect(Predicate.isTagged(second, 'InvalidConfig')).toBe(true)
    })
  )
})
