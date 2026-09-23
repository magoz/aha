import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import { parsePreviewArgs } from '../tools/preview-args.js'

describe('preview args', () => {
  it.effect('parses a bare file with defaults', () =>
    Effect.gen(function* () {
      const options = yield* parsePreviewArgs(['page.html'])

      expect(options.file).toBe('page.html')
      expect(options.outDir).toBe(null)
      expect(options.serve).toBe(false)
      expect(options.port).toBe(null)
    })
  )

  it.effect('parses out, serve and port flags', () =>
    Effect.gen(function* () {
      const options = yield* parsePreviewArgs([
        'page.html',
        '--out',
        'shots',
        '--serve',
        '--port',
        '4123'
      ])

      expect(options.file).toBe('page.html')
      expect(options.outDir).toBe('shots')
      expect(options.serve).toBe(true)
      expect(options.port).toBe(4123)
    })
  )

  it.effect('rejects missing files, bad ports and unknown flags', () =>
    Effect.gen(function* () {
      const missing = yield* Effect.flip(parsePreviewArgs([]))

      expect(Predicate.isTagged(missing, 'PreviewUsageError')).toBe(true)

      const badPort = yield* Effect.flip(parsePreviewArgs(['page.html', '--port', 'abc']))

      expect(Predicate.isTagged(badPort, 'PreviewUsageError')).toBe(true)

      const outOfRange = yield* Effect.flip(parsePreviewArgs(['page.html', '--port', '99999']))

      expect(Predicate.isTagged(outOfRange, 'PreviewUsageError')).toBe(true)

      const unknown = yield* Effect.flip(parsePreviewArgs(['page.html', '--zoom']))

      expect(Predicate.isTagged(unknown, 'PreviewUsageError')).toBe(true)
    })
  )
})
