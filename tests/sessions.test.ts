import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'
import { TestClock } from 'effect/testing'

import {
  PAIRING_TTL_MS,
  SESSION_COOKIE,
  completePairing,
  createPairing,
  isPairedBrowser,
  labelFromUserAgent,
  listSessions,
  revokeAllSessions,
  sessionCookie,
  sessionTokenFromCookies
} from '../lib/sessions.js'
import { TEST_CONFIG, makeTestContext, ownerAuth } from './helpers.js'

describe('browser sessions', () => {
  it.effect('pairs once, stores only hashes and authenticates the cookie token', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      const pairing = yield* createPairing(ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const token = yield* completePairing(pairing.code, 'Firefox/130 (Windows NT 10)').pipe(
        Effect.provide(ctx.layer)
      )

      expect(ctx.state.pairings.size).toBe(0)
      expect(Array.from(ctx.state.sessions.keys()).some((key) => key.includes(token))).toBe(false)
      expect(yield* isPairedBrowser(token).pipe(Effect.provide(ctx.layer))).toBe(true)

      const reused = yield* Effect.flip(
        completePairing(pairing.code, null).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(reused, 'PairingInvalid')).toBe(true)

      const sessions = yield* listSessions(ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      expect(sessions.map((session) => session.label)).toEqual(['Firefox on Windows'])
    })
  )

  it.effect('rejects expired codes and uses them up anyway', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      const pairing = yield* createPairing(ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      yield* TestClock.adjust(PAIRING_TTL_MS + 1)

      const expired = yield* Effect.flip(
        completePairing(pairing.code, null).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(expired, 'PairingInvalid')).toBe(true)
      expect(ctx.state.pairings.size).toBe(0)
      expect(ctx.state.sessions.size).toBe(0)
    })
  )

  it.effect('only the owner creates pairings, lists and revokes sessions', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      for (const authorization of [null, 'Bearer guess', ownerAuth().toLowerCase()]) {
        const create = yield* Effect.flip(
          createPairing(authorization, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
        )

        const list = yield* Effect.flip(
          listSessions(authorization, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
        )

        const revoke = yield* Effect.flip(
          revokeAllSessions(authorization, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
        )

        expect(
          [create, list, revoke].every((error) => Predicate.isTagged(error, 'Unauthorized'))
        ).toBe(true)
      }
    })
  )

  it.effect('revoking every session logs every browser out', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      const tokens: Array<string> = []

      for (let index = 0; index < 3; index += 1) {
        const pairing = yield* createPairing(ownerAuth(), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )

        tokens.push(yield* completePairing(pairing.code, null).pipe(Effect.provide(ctx.layer)))
      }

      const revoked = yield* revokeAllSessions(ownerAuth(), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(revoked).toBe(3)

      for (const token of tokens) {
        expect(yield* isPairedBrowser(token).pipe(Effect.provide(ctx.layer))).toBe(false)
      }
    })
  )

  it.effect('fails closed when storage is down', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      ctx.state.failAll = true

      const failure = yield* Effect.flip(
        isPairedBrowser('a'.repeat(43)).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(failure, 'StorageUnavailable')).toBe(true)
    })
  )

  it('parses only well-formed session cookies', () => {
    const token = 'A'.repeat(43)

    expect(sessionTokenFromCookies(`other=1; ${SESSION_COOKIE}=${token}`)).toBe(token)
    expect(sessionTokenFromCookies(`${SESSION_COOKIE}=short`)).toBe(null)
    expect(sessionTokenFromCookies(`x${SESSION_COOKIE}=${token}`)).toBe(null)
    expect(sessionTokenFromCookies(null)).toBe(null)
  })

  it('sets a host-only, secure, http-only, lax cookie', () => {
    const cookie = sessionCookie('A'.repeat(43))

    expect(cookie.startsWith('__Host-')).toBe(true)
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).not.toContain('Domain=')
  })

  it('labels common browsers', () => {
    expect(
      labelFromUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1'
      )
    ).toBe('Safari on iPhone')
    expect(labelFromUserAgent('Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile Safari/537')).toBe(
      'Chrome on Android'
    )
    expect(labelFromUserAgent(null)).toBe('Browser')
  })
})
