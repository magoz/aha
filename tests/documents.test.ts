import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate } from 'effect'

import type { ServiceConfig } from '../lib/config.js'
import {
  authorizeRead,
  deleteDocument,
  listDocuments,
  publishDocument,
  unpublishDocument,
  updateDocument,
  uploadDocument
} from '../lib/documents.js'
import { MAX_HTML_BYTES } from '../lib/html-limits.js'
import { completePairing, createPairing } from '../lib/sessions.js'
import { AhaStorageTag } from '../lib/storage.js'
import { collect, streamOf } from './fake-storage.js'
import {
  TEST_CONFIG,
  bytesToString,
  htmlBytes,
  makeTestContext,
  ownerAuth,
  uploadOf
} from './helpers.js'

const SAMPLE = '<!doctype html><html><body><p>synthetic fixture</p></body></html>'

const LEGACY_ID = 'AbCdEfGhIjKlMnOpQr_-12'

// Authorizes like a page request, then reads the whole body for assertions.
function readDocumentWithAccess(
  id: string,
  authorization: string | null,
  config: ServiceConfig,
  sessionToken: string | null = null
) {
  return Effect.gen(function* () {
    const access = yield* authorizeRead(id, { authorization, sessionToken }, config)
    const storage = yield* AhaStorageTag
    const document = yield* storage.getDocument(access.id)
    const text = bytesToString(yield* Effect.promise(() => collect(document.body)))

    return { document: { text, etag: document.etag }, grant: access.grant }
  })
}

describe('documents', () => {
  it.effect('uploads privately and reads back with owner token', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        'sample-doc',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const read = yield* readDocumentWithAccess(created.id, ownerAuth(), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(read.document.text).toBe(SAMPLE)
      expect(read.document.etag.length > 0).toBe(true)
    })
  )

  it.effect('denies anonymous reads of private documents', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        'sample-doc',
        uploadOf(SAMPLE),
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
        'sample-doc',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const open = yield* readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(open.document.text).toBe(SAMPLE)

      yield* unpublishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const closed = yield* Effect.flip(
        readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(closed, 'Unauthorized')).toBe(true)
    })
  )

  it.effect('paired browsers read private documents but nothing else', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        'sample-doc',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const pairing = yield* createPairing(ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      const token = yield* completePairing(pairing.code, null).pipe(Effect.provide(ctx.layer))

      const read = yield* readDocumentWithAccess(created.id, null, TEST_CONFIG, token).pipe(
        Effect.provide(ctx.layer)
      )

      expect(read.document.text).toBe(SAMPLE)
      expect(read.grant).toBe('paired-browser')

      const forged = yield* Effect.flip(
        readDocumentWithAccess(created.id, null, TEST_CONFIG, 'x'.repeat(43)).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(Predicate.isTagged(forged, 'Unauthorized')).toBe(true)

      const asBearer = yield* Effect.flip(
        publishDocument(created.id, `Bearer ${token}`, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(asBearer, 'Unauthorized')).toBe(true)

      const listFailure = yield* Effect.flip(
        listDocuments(`Bearer ${token}`, false, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(listFailure, 'Unauthorized')).toBe(true)
    })
  )

  it.effect('rejects forged credential headers', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        'sample-doc',
        uploadOf(SAMPLE),
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
        'sample-doc',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(created.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const revised = '<!doctype html><html><body><p>revised</p></body></html>'

      const etag = yield* updateDocument(
        created.id,
        uploadOf(revised),
        'text/html',
        ownerAuth(),
        null,
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(etag.length > 0).toBe(true)

      const open = yield* readDocumentWithAccess(created.id, null, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(open.document.text).toBe(revised)

      const conflict = yield* Effect.flip(
        updateDocument(
          created.id,
          uploadOf(revised),
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
          uploadOf(SAMPLE),
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
        'sample-doc',
        uploadOf(SAMPLE),
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
        'sample-doc',
        uploadOf(SAMPLE),
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
        uploadDocument(
          'wrong-type',
          uploadOf(SAMPLE),
          'application/json',
          ownerAuth(),
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(wrongType, 'UnsupportedMediaType')).toBe(true)

      const big = { body: streamOf(new Uint8Array(0)), contentLength: MAX_HTML_BYTES + 1 }

      const tooLarge = yield* Effect.flip(
        uploadDocument('too-big', big, 'text/html', ownerAuth(), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(Predicate.isTagged(tooLarge, 'PayloadTooLarge')).toBe(true)

      const unsized = yield* Effect.flip(
        uploadDocument('no-length', null, 'text/html', ownerAuth(), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(Predicate.isTagged(unsized, 'LengthRequired')).toBe(true)

      const lying = { body: streamOf(htmlBytes(SAMPLE)), contentLength: 3 }

      const mismatch = yield* Effect.flip(
        uploadDocument('lying-length', lying, 'text/html', ownerAuth(), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(Predicate.isTagged(mismatch, 'LengthMismatch')).toBe(true)
      expect(ctx.state.documents.size).toBe(0)
    })
  )

  it.effect('lists with public filtering for owner only', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const first = yield* uploadDocument(
        'sample-doc',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const second = yield* uploadDocument(
        'second-doc',
        uploadOf(SAMPLE),
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
      expect(second.id).toBe('second-doc')
    })
  )

  it.effect('uploads under the requested readable name', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const created = yield* uploadDocument(
        'q3-launch-plan',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(created.id).toBe('q3-launch-plan')
      expect(ctx.state.documents.has('q3-launch-plan')).toBe(true)
      expect(ctx.state.markers.size).toBe(0)
    })
  )

  it.effect('refuses to overwrite a taken name and leaves the original untouched', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const original = yield* uploadDocument(
        'taken-name',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      yield* publishDocument(original.id, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const clash = yield* Effect.flip(
        uploadDocument(
          'taken-name',
          uploadOf('<!doctype html><p>intruder</p>'),
          'text/html',
          ownerAuth(),
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(clash, 'DocumentExists')).toBe(true)

      const read = yield* readDocumentWithAccess('taken-name', null, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(read.document.text).toBe(SAMPLE)
      expect(read.document.etag).toBe(original.etag)
    })
  )

  it.effect('treats a name with a leftover public marker as taken', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      ctx.state.markers.add('orphan-name')

      const clash = yield* Effect.flip(
        uploadDocument('orphan-name', uploadOf(SAMPLE), 'text/html', ownerAuth(), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(Predicate.isTagged(clash, 'DocumentExists')).toBe(true)
      expect(ctx.state.documents.has('orphan-name')).toBe(false)
      expect(ctx.state.markers.has('orphan-name')).toBe(true)
    })
  )

  it.effect('fails closed when the marker check fails during upload', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      ctx.state.failAll = true

      const failure = yield* Effect.flip(
        uploadDocument('any-name', uploadOf(SAMPLE), 'text/html', ownerAuth(), TEST_CONFIG).pipe(
          Effect.provide(ctx.layer)
        )
      )

      expect(
        Predicate.isTagged(failure, 'StorageUnavailable') &&
          failure.operation === 'markerExists:injected'
      ).toBe(true)
      expect(ctx.state.documents.size).toBe(0)
    })
  )

  it.effect('unpublish clears a leftover marker so the name can be reused', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      ctx.state.markers.add('orphan-name')

      const missing = yield* Effect.flip(
        unpublishDocument('orphan-name', ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(missing, 'DocumentNotFound')).toBe(true)
      expect(ctx.state.markers.has('orphan-name')).toBe(false)

      const created = yield* uploadDocument(
        'orphan-name',
        uploadOf(SAMPLE),
        'text/html',
        ownerAuth(),
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      expect(created.id).toBe('orphan-name')
      expect(ctx.state.markers.has('orphan-name')).toBe(false)
    })
  )

  it.effect('rejects missing and invalid names before touching storage', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()
      const names = [null, '', 'Upper', 'has.dot', 'a/b', '..', '%2e', '-lead', 'api', LEGACY_ID]

      for (const name of names) {
        const failure = yield* Effect.flip(
          uploadDocument(name, uploadOf(SAMPLE), 'text/html', ownerAuth(), TEST_CONFIG).pipe(
            Effect.provide(ctx.layer)
          )
        )

        expect(Predicate.isTagged(failure, 'InvalidDocumentName')).toBe(true)
      }

      expect(ctx.state.documents.size).toBe(0)
    })
  )

  it.effect('checks ownership before the name', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      const failure = yield* Effect.flip(
        uploadDocument(
          null,
          uploadOf(SAMPLE),
          'text/html',
          'Bearer not-the-owner',
          TEST_CONFIG
        ).pipe(Effect.provide(ctx.layer))
      )

      expect(Predicate.isTagged(failure, 'Unauthorized')).toBe(true)
    })
  )

  it.effect('legacy random ids stay readable, updatable and publishable', () =>
    Effect.gen(function* () {
      const ctx = makeTestContext()

      ctx.state.documents.set(LEGACY_ID, { body: htmlBytes(SAMPLE), etag: '"legacy"', version: 1 })

      const owner = yield* readDocumentWithAccess(LEGACY_ID, ownerAuth(), TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(owner.document.text).toBe(SAMPLE)

      yield* publishDocument(LEGACY_ID, ownerAuth(), TEST_CONFIG).pipe(Effect.provide(ctx.layer))

      const revised = '<!doctype html><html><body><p>legacy v2</p></body></html>'

      yield* updateDocument(
        LEGACY_ID,
        uploadOf(revised),
        'text/html',
        ownerAuth(),
        '"legacy"',
        TEST_CONFIG
      ).pipe(Effect.provide(ctx.layer))

      const open = yield* readDocumentWithAccess(LEGACY_ID, null, TEST_CONFIG).pipe(
        Effect.provide(ctx.layer)
      )

      expect(open.document.text).toBe(revised)
      expect(open.grant).toBe('public')
    })
  )
})
