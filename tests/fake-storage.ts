import { Effect } from 'effect'

import { DocumentNotFound, PreconditionFailed, StorageUnavailable } from '../lib/errors.js'
import { isPlanId } from '../lib/plan-id.js'
import type { PlanId } from '../lib/plan-id.js'
import type {
  DocumentHead,
  ListEntry,
  AhaStorage,
  PutOptions,
  StoredDocument
} from '../lib/storage.js'

interface FakeEntry {
  body: Uint8Array
  etag: string
  version: number
}

export interface FakeStorageState {
  readonly documents: Map<string, FakeEntry>
  readonly markers: Set<string>
  failAll: boolean
}

export function createFakeState(): FakeStorageState {
  return { documents: new Map(), markers: new Set(), failAll: false }
}

function normalizeEtag(etag: string): string {
  const trimmed = etag.trim()
  const withoutWeak = trimmed.startsWith('W/') ? trimmed.slice(2) : trimmed

  if (withoutWeak.length >= 2 && withoutWeak.startsWith('"') && withoutWeak.endsWith('"')) {
    return withoutWeak.slice(1, withoutWeak.length - 1)
  }

  return withoutWeak
}

export function createFakeStorage(state: FakeStorageState): AhaStorage {
  const checkFailed = <A>(
    operation: string,
    run: () => A
  ): Effect.Effect<A, StorageUnavailable> => {
    if (state.failAll) {
      return Effect.fail(new StorageUnavailable({ operation }))
    }

    return Effect.sync(run)
  }

  return {
    getDocument: (
      id: PlanId
    ): Effect.Effect<StoredDocument, StorageUnavailable | DocumentNotFound> =>
      Effect.suspend((): Effect.Effect<StoredDocument, StorageUnavailable | DocumentNotFound> => {
        if (state.failAll) {
          return Effect.fail(new StorageUnavailable({ operation: 'getDocument:injected' }))
        }

        const entry = state.documents.get(id)

        if (entry === undefined) {
          return Effect.fail(new DocumentNotFound({ id }))
        }

        return Effect.succeed({
          body: entry.body.slice(),
          contentType: 'text/html; charset=utf-8',
          etag: entry.etag
        })
      }),
    headDocument: (
      id: PlanId
    ): Effect.Effect<DocumentHead, StorageUnavailable | DocumentNotFound> =>
      Effect.suspend((): Effect.Effect<DocumentHead, StorageUnavailable | DocumentNotFound> => {
        if (state.failAll) {
          return Effect.fail(new StorageUnavailable({ operation: 'headDocument:injected' }))
        }

        const entry = state.documents.get(id)

        if (entry === undefined) {
          return Effect.fail(new DocumentNotFound({ id }))
        }

        return Effect.succeed({
          contentType: 'text/html; charset=utf-8',
          contentLength: entry.body.length,
          etag: entry.etag
        })
      }),
    putDocument: (
      id: PlanId,
      body: Uint8Array,
      options: PutOptions
    ): Effect.Effect<string, StorageUnavailable | DocumentNotFound | PreconditionFailed> =>
      Effect.suspend(
        (): Effect.Effect<string, StorageUnavailable | DocumentNotFound | PreconditionFailed> => {
          if (state.failAll) {
            return Effect.fail(new StorageUnavailable({ operation: 'putDocument:injected' }))
          }

          if (options.ifMatch !== null) {
            const current = state.documents.get(id)

            if (current === undefined) {
              return Effect.fail(new DocumentNotFound({ id }))
            }

            if (normalizeEtag(current.etag) !== normalizeEtag(options.ifMatch)) {
              return Effect.fail(new PreconditionFailed({ id }))
            }
          }

          const previous = state.documents.get(id)
          const version = (previous?.version ?? 0) + 1
          const etag = `"v${String(version)}-${String(body.length)}"`
          state.documents.set(id, { body: body.slice(), etag, version })

          return Effect.succeed(etag)
        }
      ),
    deleteDocument: (id: PlanId): Effect.Effect<void, StorageUnavailable | DocumentNotFound> =>
      Effect.suspend((): Effect.Effect<void, StorageUnavailable | DocumentNotFound> => {
        if (state.failAll) {
          return Effect.fail(new StorageUnavailable({ operation: 'deleteDocument:injected' }))
        }

        if (!state.documents.has(id)) {
          return Effect.fail(new DocumentNotFound({ id }))
        }

        state.documents.delete(id)

        return Effect.void
      }),
    markerExists: (id: PlanId): Effect.Effect<boolean, StorageUnavailable> =>
      checkFailed('markerExists:injected', () => state.markers.has(id)),
    putMarker: (id: PlanId): Effect.Effect<void, StorageUnavailable> =>
      checkFailed('putMarker:injected', () => {
        state.markers.add(id)
      }),
    deleteMarker: (id: PlanId): Effect.Effect<void, StorageUnavailable> =>
      checkFailed('deleteMarker:injected', () => {
        state.markers.delete(id)
      }),
    listDocuments: (): Effect.Effect<ReadonlyArray<ListEntry>, StorageUnavailable> =>
      checkFailed('listDocuments:injected', () => {
        const entries: Array<ListEntry> = []

        for (const [key, entry] of state.documents) {
          if (!isPlanId(key)) {
            continue
          }

          entries.push({ id: key, isPublic: state.markers.has(key), etag: entry.etag })
        }

        return entries
      })
  }
}
