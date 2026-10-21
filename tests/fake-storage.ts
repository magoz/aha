import { Effect } from 'effect'

import {
  DocumentExists,
  DocumentNotFound,
  PreconditionFailed,
  SessionNotFound,
  StorageUnavailable
} from '../lib/errors.js'
import { isPlanId } from '../lib/plan-id.js'
import type { BrowserSession, SessionStore } from '../lib/sessions.js'
import type { AhaStorage, ByteStream, ListEntry } from '../lib/storage.js'

interface FakeEntry {
  body: Uint8Array
  etag: string
  version: number
}

export interface FakeStorageState {
  readonly documents: Map<string, FakeEntry>
  readonly markers: Set<string>
  readonly pairings: Map<string, number>
  readonly sessions: Map<string, BrowserSession>
  failAll: boolean
}

export function createFakeState(): FakeStorageState {
  return {
    documents: new Map(),
    markers: new Set(),
    pairings: new Map(),
    sessions: new Map(),
    failAll: false
  }
}

export function streamOf(bytes: Uint8Array): ByteStream {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice())
      controller.close()
    }
  })
}

export async function collect(stream: ByteStream): Promise<Uint8Array> {
  const chunks: Array<Uint8Array> = []
  let total = 0

  const reader = stream.getReader()
  let done = false

  while (!done) {
    const next = await reader.read()

    if (next.done) {
      done = true
    } else {
      chunks.push(next.value)
      total += next.value.length
    }
  }

  const merged = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

function normalizeEtag(etag: string): string {
  const trimmed = etag.trim()
  const withoutWeak = trimmed.startsWith('W/') ? trimmed.slice(2) : trimmed

  if (withoutWeak.length >= 2 && withoutWeak.startsWith('"') && withoutWeak.endsWith('"')) {
    return withoutWeak.slice(1, withoutWeak.length - 1)
  }

  return withoutWeak
}

function guarded<A, E>(
  state: FakeStorageState,
  operation: string,
  run: () => Effect.Effect<A, E>
): Effect.Effect<A, E | StorageUnavailable> {
  return Effect.suspend((): Effect.Effect<A, E | StorageUnavailable> =>
    state.failAll
      ? Effect.fail(new StorageUnavailable({ operation: `${operation}:injected` }))
      : run()
  )
}

export function createFakeStorage(state: FakeStorageState): AhaStorage {
  return {
    getDocument: (id) =>
      guarded(state, 'getDocument', () => {
        const entry = state.documents.get(id)

        return entry === undefined
          ? Effect.fail(new DocumentNotFound({ id }))
          : Effect.succeed({
              body: streamOf(entry.body),
              contentType: 'text/html; charset=utf-8',
              contentLength: entry.body.length,
              etag: entry.etag
            })
      }),
    headDocument: (id) =>
      guarded(state, 'headDocument', () => {
        const entry = state.documents.get(id)

        return entry === undefined
          ? Effect.fail(new DocumentNotFound({ id }))
          : Effect.succeed({
              contentType: 'text/html; charset=utf-8',
              contentLength: entry.body.length,
              etag: entry.etag
            })
      }),
    putDocument: (id, upload, options) =>
      guarded(state, 'putDocument', () =>
        Effect.gen(function* () {
          const body = yield* Effect.promise(() => collect(upload.body))

          // Mirrors the length guard: a body that differs from its declared length is not stored.
          if (body.length !== upload.contentLength) {
            return yield* new StorageUnavailable({ operation: 'putDocument:length-mismatch' })
          }

          // Mirrors conditional `If-None-Match: *` / `If-Match` puts: checked and written atomically.
          if (options.createOnly && state.documents.has(id)) {
            return yield* new DocumentExists({ id })
          }

          const current = state.documents.get(id)

          if (
            !options.createOnly &&
            options.ifMatch !== null &&
            (current === undefined ||
              normalizeEtag(current.etag) !== normalizeEtag(options.ifMatch))
          ) {
            return yield* new PreconditionFailed({ id })
          }

          const version = (current?.version ?? 0) + 1
          const etag = `"v${String(version)}-${String(body.length)}"`
          state.documents.set(id, { body, etag, version })

          return etag
        })
      ),
    deleteDocument: (id) =>
      guarded(state, 'deleteDocument', () => {
        if (!state.documents.delete(id)) {
          return Effect.fail(new DocumentNotFound({ id }))
        }

        return Effect.void
      }),
    markerExists: (id) =>
      guarded(state, 'markerExists', () => Effect.succeed(state.markers.has(id))),
    putMarker: (id) =>
      guarded(state, 'putMarker', () =>
        Effect.sync(() => {
          state.markers.add(id)
        })
      ),
    deleteMarker: (id) =>
      guarded(state, 'deleteMarker', () =>
        Effect.sync(() => {
          state.markers.delete(id)
        })
      ),
    listDocuments: () =>
      guarded(state, 'listDocuments', () =>
        Effect.sync(() => {
          const entries: Array<ListEntry> = []

          for (const [key, entry] of state.documents) {
            if (isPlanId(key)) {
              entries.push({ id: key, isPublic: state.markers.has(key), etag: entry.etag })
            }
          }

          return entries
        })
      )
  }
}

export function createFakeSessionStore(state: FakeStorageState): SessionStore {
  return {
    putPairing: (codeHash, expiresAt) =>
      guarded(state, 'putPairing', () =>
        Effect.sync(() => {
          state.pairings.set(codeHash, expiresAt)
        })
      ),
    takePairing: (codeHash) =>
      guarded(state, 'takePairing', () =>
        Effect.sync(() => {
          const expiresAt = state.pairings.get(codeHash) ?? null
          state.pairings.delete(codeHash)

          return expiresAt
        })
      ),
    putSession: (session) =>
      guarded(state, 'putSession', () =>
        Effect.sync(() => {
          state.sessions.set(session.id, session)
        })
      ),
    sessionExists: (id) =>
      guarded(state, 'sessionExists', () => Effect.succeed(state.sessions.has(id))),
    listSessions: () =>
      guarded(state, 'listSessions', () => Effect.succeed(Array.from(state.sessions.values()))),
    deleteSession: (id) =>
      guarded(state, 'deleteSession', () =>
        state.sessions.delete(id) ? Effect.void : Effect.fail(new SessionNotFound({ id }))
      )
  }
}
