import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import { parseCliArgs, validateEndpoint } from '../cli/parser.js'

const TOKEN_ENV = { PLANS_OWNER_TOKEN: 'owner-token-for-tests' }

describe('cli parser', () => {
  it.effect('parses upload with defaults', () =>
    Effect.gen(function* () {
      const request = yield* parseCliArgs(['upload', './page.html'], TOKEN_ENV)

      if (request.command !== 'upload') {
        expect(false).toBe(true)

        return
      }

      expect(request.file).toBe('./page.html')
      expect(request.endpoint).toBe('https://plans.oox.sh')
      expect(request.publicUrl).toBe('https://plans.oox.sh')
      expect(request.token).toBe('owner-token-for-tests')
    })
  )

  it.effect('separates share urls from the api endpoint', () =>
    Effect.gen(function* () {
      const id = 'AAAAAAAAAAAAAAAAAAAAAA'
      const alias = 'https://plans-private-alias.example.com'

      const publish = yield* parseCliArgs(['publish', id, '--endpoint', alias], {
        ...TOKEN_ENV,
        PLANS_PUBLIC_URL: 'https://plans.oox.sh/'
      })

      if (publish.command !== 'publish') {
        expect(false).toBe(true)

        return
      }

      expect(publish.endpoint).toBe(alias)
      expect(publish.publicUrl).toBe('https://plans.oox.sh')

      const flagged = yield* parseCliArgs(
        ['upload', './page.html', '--public-url', `${alias}/share/`],
        TOKEN_ENV
      )

      if (flagged.command !== 'upload') {
        expect(false).toBe(true)

        return
      }

      expect(flagged.publicUrl).toBe(`${alias}/share`)
    })
  )

  it.effect('parses update with if-match and publish/unpublish/delete', () =>
    Effect.gen(function* () {
      const id = 'AAAAAAAAAAAAAAAAAAAAAA'

      const update = yield* parseCliArgs(
        ['update', id, './v2.html', '--if-match', '"v1"'],
        TOKEN_ENV
      )

      if (update.command !== 'update') {
        expect(false).toBe(true)

        return
      }

      expect(update.ifMatch).toBe('"v1"')

      const publish = yield* parseCliArgs(['publish', id], TOKEN_ENV)

      expect(publish.command).toBe('publish')

      const list = yield* parseCliArgs(['list', '--public', '--json'], TOKEN_ENV)

      if (list.command !== 'list') {
        expect(false).toBe(true)

        return
      }

      expect(list.onlyPublic).toBe(true)
      expect(list.asJson).toBe(true)
    })
  )

  it.effect('rejects invalid ids and unknown commands', () =>
    Effect.gen(function* () {
      const badId = yield* Effect.flip(parseCliArgs(['publish', 'nope'], TOKEN_ENV))

      expect(Predicate.isTagged(badId, 'CliUsageError')).toBe(true)

      const unknown = yield* Effect.flip(parseCliArgs(['frobnicate'], TOKEN_ENV))

      expect(Predicate.isTagged(unknown, 'CliUsageError')).toBe(true)
    })
  )

  it.effect('reads tokens from a 0600 credentials file', () =>
    Effect.gen(function* () {
      const dir = yield* Effect.tryPromise({
        try: () => mkdtemp(join(tmpdir(), 'plans-cli-')),
        catch: () => new Error('mkdtemp failed')
      })

      try {
        const file = join(dir, 'credentials')
        yield* Effect.tryPromise({
          try: () =>
            writeFile(file, 'PLANS_OWNER_TOKEN=file-token\n').then(() => chmod(file, 0o600)),
          catch: () => new Error('write failed')
        })
        const request = yield* parseCliArgs(['list'], { PLANS_CREDENTIALS_FILE: file })

        if (request.command !== 'list') {
          expect(false).toBe(true)

          return
        }

        expect(request.token).toBe('file-token')
      } finally {
        yield* Effect.tryPromise({
          try: () => rm(dir, { recursive: true }),
          catch: () => new Error('cleanup failed')
        })
      }
    })
  )

  it.effect('rejects credentials files with open permissions', () =>
    Effect.gen(function* () {
      const dir = yield* Effect.tryPromise({
        try: () => mkdtemp(join(tmpdir(), 'plans-cli-')),
        catch: () => new Error('mkdtemp failed')
      })

      try {
        const file = join(dir, 'credentials')
        yield* Effect.tryPromise({
          try: () =>
            writeFile(file, 'PLANS_OWNER_TOKEN=file-token\n').then(() => chmod(file, 0o644)),
          catch: () => new Error('write failed')
        })
        const failure = yield* Effect.flip(parseCliArgs(['list'], { PLANS_CREDENTIALS_FILE: file }))

        expect(Predicate.isTagged(failure, 'CliUsageError')).toBe(true)
      } finally {
        yield* Effect.tryPromise({
          try: () => rm(dir, { recursive: true }),
          catch: () => new Error('cleanup failed')
        })
      }
    })
  )

  it.effect('requires a token and validates endpoints', () =>
    Effect.gen(function* () {
      const missing = yield* Effect.flip(parseCliArgs(['list'], {}))

      expect(Predicate.isTagged(missing, 'CliUsageError')).toBe(true)

      const https = yield* validateEndpoint('https://plans.oox.sh')

      expect(https).toBe('https://plans.oox.sh')

      const loopback = yield* validateEndpoint('http://127.0.0.1:3939')

      expect(loopback).toBe('http://127.0.0.1:3939')

      const rejected = yield* Effect.flip(validateEndpoint('http://example.com'))

      expect(Predicate.isTagged(rejected, 'CliUsageError')).toBe(true)
    })
  )
})
