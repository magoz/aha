import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import {
  deleteDocument,
  listDocuments,
  publishDocument,
  readDocumentWithAccess,
  unpublishDocument,
  updateDocument,
  uploadDocument
} from '../lib/documents.js'
import {
  TEST_CONFIG,
  bytesToString,
  htmlBytes,
  makeTestContext,
  ownerAuth,
  privateAuth
} from './helpers.js'

const SAMPLE = '<!doctype html><html><body><p>synthetic fixture</p></body></html>'

describe('documents', () => {
  it.effect('uploads privately and reads back with owner token', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const read = yield* readDocumentWithAccess(created.id, ownerAuth(), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(bytesToString(read.document.body)).toBe(SAMPLE)
      expect(read.document.etag.length > 0).toBe(true)
    })
  )

  it.effect('denies anonymous reads of private documents', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const failure = yield* Effect.flip(
        readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(failure, 'Unauthorized')).toBe(true)
    })
  )

  it.effect('publishes and unpublishes through marker lifecycle', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const open = yield* readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(bytesToString(open.document.body)).toBe(SAMPLE)

      yield* unpublishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const closed = yield* Effect.flip(
        readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(closed, 'Unauthorized')).toBe(true)
    })
  )

  it.effect('grants private-read token content access but no mutations', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const read = yield* readDocumentWithAccess(created.id, privateAuth(), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(bytesToString(read.document.body)).toBe(SAMPLE)

      const publishFailure = yield* Effect.flip(
        publishDocument(created.id, privateAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(publishFailure, 'Unauthorized')).toBe(true)

      const listFailure = yield* Effect.flip(
        listDocuments(privateAuth(), false, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(listFailure, 'Unauthorized')).toBe(true)
    })
  )

  it.effect('rejects forged credential headers', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const failure = yield* Effect.flip(
        readDocumentWithAccess(created.id, 'Bearer forged-token', TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(Predicate.isTagged(failure, 'Unauthorized')).toBe(true)
    })
  )

  it.effect('update preserves visibility and enforces preconditions', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const revised = '<!doctype html><html><body><p>revised</p></body></html>'

      const etag = yield* updateDocument(
        created.id,
        htmlBytes(revised),
        'text/html',
        ownerAuth(),
        null,
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(etag.length > 0).toBe(true)

      const open = yield* readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(bytesToString(open.document.body)).toBe(revised)

      const conflict = yield* Effect.flip(
        updateDocument(
          created.id,
          htmlBytes(revised),
          'text/html',
          ownerAuth(),
          '"stale"',
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(conflict, 'PreconditionFailed')).toBe(true)
    })
  )

  it.effect('update never creates unknown ids', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const failure = yield* Effect.flip(
        updateDocument(
          'AAAAAAAAAAAAAAAAAAAAAA',
          htmlBytes(SAMPLE),
          'text/html',
          ownerAuth(),
          null,
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(failure, 'DocumentNotFound')).toBe(true)
    })
  )

  it.effect('delete requires unpublished documents', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const blocked = yield* Effect.flip(
        deleteDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(blocked, 'PreconditionFailed')).toBe(true)

      yield* unpublishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      yield* deleteDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const gone = yield* Effect.flip(
        readDocumentWithAccess(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(gone, 'DocumentNotFound')).toBe(true)
    })
  )

  it.effect('storage failures fail closed', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      ctx.state.failAll = true

      const denied = yield* Effect.flip(
        readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(denied, 'StorageUnavailable')).toBe(true)
    })
  )

  it.effect('rejects non-html uploads and oversized bodies', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const wrongType = yield* Effect.flip(
        uploadDocument(htmlBytes(SAMPLE), 'application/json', ownerAuth(), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(Predicate.isTagged(wrongType, 'UnsupportedMediaType')).toBe(true)

      const big = new Uint8Array(2 * 1024 * 1024 + 1)

      const tooLarge = yield* Effect.flip(
        uploadDocument(big, 'text/html', ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(tooLarge, 'PayloadTooLarge')).toBe(true)
    })
  )

  it.effect('lists with public filtering for owner only', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const first = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const second = yield* uploadDocument(
        htmlBytes(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(first.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const all = yield* listDocuments(ownerAuth(), false, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      const open = yield* listDocuments(ownerAuth(), true, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(all.length).toBe(2)
      expect(open.length).toBe(1)
      expect(open[0]?.id).toBe(first.id)
      expect(second.id.length).toBe(22)
    })
  )
})
