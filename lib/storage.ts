import type { Effect } from 'effect'
import { Context } from 'effect'

import type { DocumentNotFound, PreconditionFailed, StorageUnavailable } from './errors.js'
import type { PlanId } from './plan-id.js'

export interface StoredDocument {
  readonly body: Uint8Array
  readonly contentType: string
  readonly etag: string
}

export interface DocumentHead {
  readonly contentType: string
  readonly contentLength: number
  readonly etag: string
}

export interface ListEntry {
  readonly id: PlanId
  readonly isPublic: boolean
  readonly etag: string
}

export interface PutOptions {
  readonly ifMatch: string | null
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
    body: Uint8Array,
    options: PutOptions
  ) => Effect.Effect<string, StorageUnavailable | DocumentNotFound | PreconditionFailed>
  readonly deleteDocument: (
    id: PlanId
  ) => Effect.Effect<void, StorageUnavailable | DocumentNotFound>
  readonly markerExists: (id: PlanId) => Effect.Effect<boolean, StorageUnavailable>
  readonly putMarker: (id: PlanId) => Effect.Effect<void, StorageUnavailable>
  readonly deleteMarker: (id: PlanId) => Effect.Effect<void, StorageUnavailable>
  readonly listDocuments: () => Effect.Effect<ReadonlyArray<ListEntry>, StorageUnavailable>
}

export class AhaStorageTag extends Context.Service<AhaStorageTag, AhaStorage>()('AhaStorage') {}
