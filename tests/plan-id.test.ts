import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import {
  documentKey,
  isNewDocumentName,
  isPlanId,
  isReservedDocumentName,
  markerKey,
  parseNewDocumentName,
  parsePlanId
} from '../lib/plan-id.js'

const LEGACY_ID = 'AbCdEfGhIjKlMnOpQr_-12'

describe('plan-id', () => {
  it.effect('accepts legacy random ids and readable names', () =>
    Effect.gen(function* () {
      for (const candidate of [LEGACY_ID, 'q3-launch-plan', 'a', 'Mixed_Case-9', 'x'.repeat(80)]) {
        expect(isPlanId(candidate)).toBe(true)
      }

      const parsed = yield* parsePlanId(LEGACY_ID)

      expect(parsed).toBe(LEGACY_ID)
      expect(documentKey(parsed)).toBe(`aha/${LEGACY_ID}.html`)
      expect(markerKey(parsed)).toBe(`public/${LEGACY_ID}`)
    })
  )

  it.effect('rejects traversal and malformed ids', () =>
    Effect.gen(function* () {
      const bad = [
        '',
        '..',
        '../secret',
        'aha/x.html',
        'has.dot',
        '%2e%2e',
        'a'.repeat(81),
        'abc+def/ghi=jklmnopqrs',
        'has space',
        'back\\slash',
        'caf\u00e9'
      ]

      for (const candidate of bad) {
        expect(isPlanId(candidate)).toBe(false)
      }

      const failure = yield* Effect.flip(parsePlanId('../secret'))

      expect(Predicate.isTagged(failure, 'InvalidPlanId')).toBe(true)
    })
  )

  it.effect('accepts lowercase dash-separated new names up to 80 characters', () =>
    Effect.gen(function* () {
      for (const candidate of ['a', 'q3', 'q3-launch-plan', '2025-01-02-notes', 'x'.repeat(80)]) {
        expect(isNewDocumentName(candidate)).toBe(true)
      }

      const parsed = yield* parseNewDocumentName('q3-launch-plan')

      expect(parsed).toBe('q3-launch-plan')
    })
  )

  it.effect('rejects unsafe, non-canonical and reserved new names', () =>
    Effect.gen(function* () {
      const bad = [
        '',
        'Upper',
        'UPPER-CASE',
        'has.dot',
        'page.html',
        'a/b',
        '..',
        '.',
        '%2e',
        '%2e%2e',
        '-leading',
        'trailing-',
        'double--dash',
        'under_score',
        'has space',
        'x'.repeat(81),
        'api',
        LEGACY_ID
      ]

      for (const candidate of bad) {
        expect(isNewDocumentName(candidate)).toBe(false)
      }

      expect(isReservedDocumentName('api')).toBe(true)
      expect(isReservedDocumentName('API')).toBe(true)
      expect(isReservedDocumentName('apis')).toBe(false)

      const failure = yield* Effect.flip(parseNewDocumentName('api'))

      expect(Predicate.isTagged(failure, 'InvalidDocumentName')).toBe(true)
    })
  )
})
