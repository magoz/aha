import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import type { EnvMap, HeaderMap } from '../lib/headers.js'
import { readConfig } from '../lib/config.js'

function envWith(overrides: HeaderMap): EnvMap {
  return { AHA_OWNER_TOKEN: 'owner-token', ...overrides }
}

describe('config', () => {
  it.effect('reads complete config with the default public url', () =>
    Effect.gen(function* () {
      const config = yield* readConfig(envWith({}))

      expect(config.ownerToken).toBe('owner-token')
      expect(config.publicUrl).toBe('https://aha.o-o.co')
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

  it.effect('rejects a missing or blank owner token', () =>
    Effect.gen(function* () {
      const missing = yield* Effect.flip(readConfig({}))
      const blank = yield* Effect.flip(readConfig(envWith({ AHA_OWNER_TOKEN: '  ' })))

      expect(Predicate.isTagged(missing, 'InvalidConfig')).toBe(true)
      expect(Predicate.isTagged(blank, 'InvalidConfig')).toBe(true)
    })
  )
})
