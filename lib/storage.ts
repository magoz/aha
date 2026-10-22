import type { Effect } from 'effect'
import { Context } from 'effect'

import type {
  DocumentExists,
  DocumentNotFound,
  LengthMismatch,
  PreconditionFailed,
  StorageUnavailable
} from './errors.js'
import type { PlanId } from './plan-id.js'

// Document bytes are streamed end to end; a 95 MiB page never sits in Worker memory.
export type ByteStream = ReadableStream<Uint8Array>

export interface DocumentHead {
  readonly contentType: string
  readonly contentLength: number
  readonly etag: string
}

export interface StoredDocument extends DocumentHead {
  readonly body: ByteStream
}

// A request body with its declared `Content-Length`. Storage must reject a body whose actual length
// differs, so the size checked against the limit is the size stored.
export interface DocumentUpload {
  readonly body: ByteStream
  readonly contentLength: number
}

export interface ListEntry {
  readonly id: PlanId
  readonly isPublic: boolean
  readonly etag: string
}

export interface PutOptions {
  readonly ifMatch: string | null
  // Create-only write (conditional `If-None-Match: *`): fails with DocumentExists when the key is
  // taken. Race-safe because the storage backend enforces it atomically. Takes precedence over
  // ifMatch.
  readonly createOnly: boolean
  readonly contentType: string
}

export interface AhaStorage {
  readonly getDocument: (
    id: PlanId
  ) => Effect.Effect<StoredDocument, StorageUnavailable | DocumentNotFound>
  readonly headDocument: (
    id: PlanId
  ) => Effect.Effect<DocumentHead, StorageUnavailable | DocumentNotFound>
  readonly putDocument: (
    id: PlanId,
    upload: DocumentUpload,
    options: PutOptions
  ) => Effect.Effect<
    string,
    StorageUnavailable | PreconditionFailed | DocumentExists | LengthMismatch
  >
  readonly deleteDocument: (
    id: PlanId
  ) => Effect.Effect<void, StorageUnavailable | DocumentNotFound>
  readonly markerExists: (id: PlanId) => Effect.Effect<boolean, StorageUnavailable>
  readonly putMarker: (id: PlanId) => Effect.Effect<void, StorageUnavailable>
  readonly deleteMarker: (id: PlanId) => Effect.Effect<void, StorageUnavailable>
  readonly listDocuments: () => Effect.Effect<ReadonlyArray<ListEntry>, StorageUnavailable>
}

export class AhaStorageTag extends Context.Service<AhaStorageTag, AhaStorage>()('AhaStorage') {}
