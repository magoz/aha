import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import { generatePlanId, isPlanId, parsePlanId } from '../lib/plan-id.js'

describe('plan-id', () => {
  it.effect('generates 22-character base64url ids', () =>
    Effect.gen(function* () {
      const first = yield* generatePlanId()
      const second = yield* generatePlanId()

      expect(first.length).toBe(22)
      expect(second.length).toBe(22)
      expect(isPlanId(first)).toBe(true)
      expect(isPlanId(second)).toBe(true)
      expect(first === second).toBe(false)
    })
  )

  it.effect('accepts generated ids through parse', () =>
    Effect.gen(function* () {
      const id = yield* generatePlanId()
      const parsed = yield* parsePlanId(id)

      expect(parsed).toBe(id)
    })
  )

  it.effect('rejects traversal and malformed ids', () =>
    Effect.gen(function* () {
      const bad = [
        '',
        '../secret',
        'aha/x.html',
        'short',
        'a'.repeat(21),
        'a'.repeat(23),
        'abc+def/ghi=jklmnopqrs',
        'has space here 12345678',
        'UPPER ok but wrong length!'
      ]

      for (const candidate of bad) {
        expect(isPlanId(candidate)).toBe(false)
      }

      const failure = yield* Effect.flip(parsePlanId('../secret'))

      expect(Predicate.isTagged(failure, 'InvalidPlanId')).toBe(true)
    })
  )
})
