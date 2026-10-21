import { Effect, Layer, Option, Schema } from 'effect'

import {
  DocumentExists,
  DocumentNotFound,
  PreconditionFailed,
  SessionNotFound,
  StorageUnavailable
} from './errors.js'
import { documentKey, isPlanId, markerKey } from './plan-id.js'
import type { PlanId } from './plan-id.js'
import { SessionStoreTag, isSessionId } from './sessions.js'
import type { BrowserSession, SessionId, SessionStore } from './sessions.js'
import { AhaStorageTag } from './storage.js'
import type { AhaStorage, ByteStream, ListEntry } from './storage.js'

// The subset of the Workers R2 binding Aha uses, typed locally so core code does not depend on
// the Workers type globals. The real binding satisfies it structurally.
export interface R2ObjectInfo {
  readonly key: string
  readonly size: number
  readonly httpEtag: string
  readonly httpMetadata?: { readonly contentType?: string | undefined } | undefined
  readonly customMetadata?: Readonly<Record<string, string>> | undefined
}

export interface R2ObjectWithBody extends R2ObjectInfo {
  readonly body: ByteStream
}

export interface R2PutOptionsLike {
  readonly onlyIf?: Headers
  readonly httpMetadata?: { readonly contentType: string }
  readonly customMetadata?: Readonly<Record<string, string>>
}

export interface R2ListOptionsLike {
  readonly prefix: string
  readonly cursor: string | undefined
  readonly include: Array<'customMetadata'>
}

export interface R2ListingLike {
  readonly objects: ReadonlyArray<R2ObjectInfo>
  readonly truncated: boolean
  readonly cursor?: string | undefined
}

export interface R2BucketLike {
  head(key: string): Promise<R2ObjectInfo | null>
  get(key: string): Promise<R2ObjectWithBody | null>
  put(
    key: string,
    value: ByteStream | string,
    options?: R2PutOptionsLike
  ): Promise<R2ObjectInfo | null>
  delete(key: string): Promise<void>
  list(options: R2ListOptionsLike): Promise<R2ListingLike>
}

// Passes the body through unchanged when it has exactly `length` bytes and errors otherwise, so R2
// receives a known-length stream and never stores more or less than was declared. In Workers this
// is `FixedLengthStream`.
export type LengthGuard = (body: ByteStream, length: number) => ByteStream

const DOCUMENT_PREFIX = 'aha/'

const MARKER_PREFIX = 'public/'

const SESSION_PREFIX = 'session/'

const PAIRING_PREFIX = 'pairing/'

const PairingMetadata = Schema.Struct({ expiresAt: Schema.FiniteFromString })

const SessionMetadata = Schema.Struct({ label: Schema.String, createdAt: Schema.String })

const decodePairing = Schema.decodeUnknownEffect(PairingMetadata)

const decodeSession = Schema.decodeUnknownEffect(SessionMetadata)

function sessionKey(id: SessionId): string {
  return `${SESSION_PREFIX}${id}`
}

function pairingKey(codeHash: string): string {
  return `${PAIRING_PREFIX}${codeHash}`
}

function call<A>(operation: string, run: () => Promise<A>): Effect.Effect<A, StorageUnavailable> {
  return Effect.tryPromise({ try: run, catch: () => new StorageUnavailable({ operation }) })
}

function listAll(
  bucket: R2BucketLike,
  prefix: string,
  withMetadata: boolean
): Effect.Effect<ReadonlyArray<R2ObjectInfo>, StorageUnavailable> {
  return Effect.gen(function* () {
    const objects: Array<R2ObjectInfo> = []
    let cursor: string | undefined
    let more = true

    while (more) {
      const options: R2ListOptionsLike = {
        prefix,
        cursor,
        include: withMetadata ? ['customMetadata'] : []
      }

      const page = yield* call(`list:${prefix}`, () => bucket.list(options))
      objects.push(...page.objects)
      cursor = page.cursor
      more = page.truncated && cursor !== undefined
    }

    return objects
  })
}

function idFromDocumentKey(key: string): PlanId | null {
  if (!key.startsWith(DOCUMENT_PREFIX) || !key.endsWith('.html')) {
    return null
  }

  const id = key.slice(DOCUMENT_PREFIX.length, key.length - '.html'.length)

  return isPlanId(id) ? id : null
}

export function makeR2Storage(bucket: R2BucketLike, guardLength: LengthGuard): AhaStorage {
  return {
    getDocument: (id) =>
      call('getDocument', () => bucket.get(documentKey(id))).pipe(
        Effect.flatMap((object) =>
          object === null
            ? Effect.fail(new DocumentNotFound({ id }))
            : Effect.succeed({
                body: object.body,
                contentType: object.httpMetadata?.contentType ?? 'text/html; charset=utf-8',
                contentLength: object.size,
                etag: object.httpEtag
              })
        )
      ),
    headDocument: (id) =>
      call('headDocument', () => bucket.head(documentKey(id))).pipe(
        Effect.flatMap((object) =>
          object === null
            ? Effect.fail(new DocumentNotFound({ id }))
            : Effect.succeed({
                contentType: object.httpMetadata?.contentType ?? 'text/html; charset=utf-8',
                contentLength: object.size,
                etag: object.httpEtag
              })
        )
      ),
    putDocument: (id, upload, options) => {
      const conditions = new Headers()

      if (options.createOnly) {
        conditions.set('if-none-match', '*')
      } else if (options.ifMatch !== null) {
        conditions.set('if-match', options.ifMatch)
      }

      return call('putDocument', () =>
        bucket.put(documentKey(id), guardLength(upload.body, upload.contentLength), {
          onlyIf: conditions,
          httpMetadata: { contentType: options.contentType }
        })
      ).pipe(
        Effect.flatMap((stored): Effect.Effect<string, PreconditionFailed | DocumentExists> => {
          if (stored !== null) {
            return Effect.succeed(stored.httpEtag)
          }

          // R2 returns null when a condition fails and stores nothing.
          return options.createOnly
            ? Effect.fail(new DocumentExists({ id }))
            : Effect.fail(new PreconditionFailed({ id }))
        })
      )
    },
    deleteDocument: (id) =>
      Effect.gen(function* () {
        if ((yield* call('headDocument', () => bucket.head(documentKey(id)))) === null) {
          return yield* new DocumentNotFound({ id })
        }

        yield* call('deleteDocument', () => bucket.delete(documentKey(id)))
      }),
    markerExists: (id) =>
      call('markerExists', () => bucket.head(markerKey(id))).pipe(
        Effect.map((object) => object !== null)
      ),
    putMarker: (id) => call('putMarker', () => bucket.put(markerKey(id), '')).pipe(Effect.asVoid),
    deleteMarker: (id) => call('deleteMarker', () => bucket.delete(markerKey(id))),
    listDocuments: () =>
      Effect.gen(function* () {
        const documents = yield* listAll(bucket, DOCUMENT_PREFIX, false)
        const markers = yield* listAll(bucket, MARKER_PREFIX, false)
        const published = new Set(markers.map((marker) => marker.key.slice(MARKER_PREFIX.length)))
        const entries: Array<ListEntry> = []

        for (const object of documents) {
          const id = idFromDocumentKey(object.key)

          if (id !== null) {
            entries.push({ id, isPublic: published.has(id), etag: object.httpEtag })
          }
        }

        return entries
      })
  }
}

export function makeR2SessionStore(bucket: R2BucketLike): SessionStore {
  return {
    putPairing: (codeHash, expiresAt) =>
      call('putPairing', () =>
        bucket.put(pairingKey(codeHash), '', {
          customMetadata: { expiresAt: String(expiresAt) }
        })
      ).pipe(Effect.asVoid),
    takePairing: (codeHash) =>
      Effect.gen(function* () {
        const key = pairingKey(codeHash)
        const object = yield* call('takePairing', () => bucket.head(key))

        if (object === null) {
          return null
        }

        // Claim the code with a conditional write before deleting it, so two concurrent POSTs of
        // one code cannot both pair: only the first rewrite of this ETag succeeds.
        const conditions = new Headers({ 'if-match': object.httpEtag })

        const claimed = yield* call('takePairing', () =>
          bucket.put(key, '', { onlyIf: conditions, customMetadata: { claimed: 'true' } })
        )

        if (claimed === null) {
          return null
        }

        yield* call('takePairing', () => bucket.delete(key))

        const metadata = yield* decodePairing(object.customMetadata).pipe(Effect.option)

        return Option.match(metadata, {
          onNone: () => null,
          onSome: (decoded) => decoded.expiresAt
        })
      }),
    putSession: (session) =>
      call('putSession', () =>
        bucket.put(sessionKey(session.id), '', {
          customMetadata: { label: session.label, createdAt: session.createdAt }
        })
      ).pipe(Effect.asVoid),
    sessionExists: (id) =>
      call('sessionExists', () => bucket.head(sessionKey(id))).pipe(
        Effect.map((object) => object !== null)
      ),
    listSessions: () =>
      Effect.gen(function* () {
        const objects = yield* listAll(bucket, SESSION_PREFIX, true)
        const sessions: Array<BrowserSession> = []

        for (const object of objects) {
          const id = object.key.slice(SESSION_PREFIX.length)

          // Sessions with unreadable metadata are still listed, so `unpair --all` revokes them too.
          const metadata = yield* decodeSession(object.customMetadata).pipe(
            Effect.orElseSucceed(() => ({ label: 'Unknown browser', createdAt: 'unknown' }))
          )

          if (isSessionId(id)) {
            sessions.push({ id, ...metadata })
          }
        }

        return sessions
      }),
    deleteSession: (id) =>
      Effect.gen(function* () {
        if ((yield* call('deleteSession', () => bucket.head(sessionKey(id)))) === null) {
          return yield* new SessionNotFound({ id })
        }

        yield* call('deleteSession', () => bucket.delete(sessionKey(id)))
      })
  }
}

export function r2Layer(
  bucket: R2BucketLike,
  guardLength: LengthGuard
): Layer.Layer<AhaStorageTag | SessionStoreTag> {
  return Layer.mergeAll(
    Layer.succeed(AhaStorageTag)(makeR2Storage(bucket, guardLength)),
    Layer.succeed(SessionStoreTag)(makeR2SessionStore(bucket))
  )
}
