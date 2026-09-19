import { Effect } from 'effect'

import { canReadContent, identifyCaller } from './auth.js'
import type { Caller } from './auth.js'
import type { ServiceConfig } from './config.js'
import {
  DocumentNotFound,
  PayloadTooLarge,
  PreconditionFailed,
  StorageUnavailable,
  Unauthorized,
  UnsupportedMediaType
} from './errors.js'
import { HTML_CONTENT_TYPE, MAX_HTML_BYTES, isHtmlContentType } from './html-limits.js'
import { generatePlanId, parsePlanId } from './plan-id.js'
import type { InvalidPlanId, PlanId } from './plan-id.js'
import { PlansStorageTag } from './storage.js'
import type { ListEntry, StoredDocument } from './storage.js'

export interface UploadResult {
  readonly id: PlanId
  readonly etag: string
}

export interface ReadResult {
  readonly document: StoredDocument
  readonly isPublic: boolean
}

function callerFromHeaders(authorization: string | null, config: ServiceConfig): Caller {
  return identifyCaller(authorization, config.ownerToken, config.privateReadToken)
}

export function uploadDocument(
  body: Uint8Array,
  contentType: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  UploadResult,
  | Unauthorized
  | UnsupportedMediaType
  | PayloadTooLarge
  | StorageUnavailable
  | DocumentNotFound
  | PreconditionFailed,
  PlansStorageTag
> {
  return Effect.gen(function* () {
    const caller = callerFromHeaders(authorization, config)

    if (caller.role !== 'owner') {
      return yield* new Unauthorized({})
    }

    if (!isHtmlContentType(contentType)) {
      return yield* new UnsupportedMediaType({ contentType })
    }

    if (body.length > MAX_HTML_BYTES) {
      return yield* new PayloadTooLarge({ limitBytes: MAX_HTML_BYTES })
    }

    const id = yield* generatePlanId()
    const storage = yield* PlansStorageTag

    const etag = yield* storage.putDocument(id, body, {
      ifMatch: null,
      contentType: HTML_CONTENT_TYPE
    })

    return { id, etag }
  })
}

export function updateDocument(
  idString: string,
  body: Uint8Array,
  contentType: string,
  authorization: string | null,
  ifMatch: string | null,
  config: ServiceConfig
): Effect.Effect<
  string,
  | Unauthorized
  | UnsupportedMediaType
  | PayloadTooLarge
  | StorageUnavailable
  | DocumentNotFound
  | PreconditionFailed
  | InvalidPlanId,
  PlansStorageTag
> {
  return Effect.gen(function* () {
    const caller = callerFromHeaders(authorization, config)

    if (caller.role !== 'owner') {
      return yield* new Unauthorized({})
    }

    if (!isHtmlContentType(contentType)) {
      return yield* new UnsupportedMediaType({ contentType })
    }

    if (body.length > MAX_HTML_BYTES) {
      return yield* new PayloadTooLarge({ limitBytes: MAX_HTML_BYTES })
    }

    const id = yield* parsePlanId(idString)
    const storage = yield* PlansStorageTag
    yield* storage.headDocument(id)

    return yield* storage.putDocument(id, body, { ifMatch, contentType: HTML_CONTENT_TYPE })
  })
}

export function readDocumentWithAccess(
  idString: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  ReadResult,
  Unauthorized | StorageUnavailable | DocumentNotFound | InvalidPlanId,
  PlansStorageTag
> {
  return Effect.gen(function* () {
    const caller = callerFromHeaders(authorization, config)
    const id = yield* parsePlanId(idString)
    const storage = yield* PlansStorageTag

    if (canReadContent(caller)) {
      const document = yield* storage.getDocument(id)

      return { document, isPublic: false }
    }

    const isPublic = yield* storage.markerExists(id)

    if (!isPublic) {
      return yield* new Unauthorized({})
    }

    const document = yield* storage.getDocument(id)

    return { document, isPublic: true }
  })
}

export function publishDocument(
  idString: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  void,
  Unauthorized | StorageUnavailable | DocumentNotFound | InvalidPlanId,
  PlansStorageTag
> {
  return Effect.gen(function* () {
    const caller = callerFromHeaders(authorization, config)

    if (caller.role !== 'owner') {
      return yield* new Unauthorized({})
    }

    const id = yield* parsePlanId(idString)
    const storage = yield* PlansStorageTag
    yield* storage.headDocument(id)
    yield* storage.putMarker(id)
  })
}

export function unpublishDocument(
  idString: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  void,
  Unauthorized | StorageUnavailable | DocumentNotFound | InvalidPlanId,
  PlansStorageTag
> {
  return Effect.gen(function* () {
    const caller = callerFromHeaders(authorization, config)

    if (caller.role !== 'owner') {
      return yield* new Unauthorized({})
    }

    const id = yield* parsePlanId(idString)
    const storage = yield* PlansStorageTag
    yield* storage.headDocument(id)
    yield* storage.deleteMarker(id)
  })
}

export function listDocuments(
  authorization: string | null,
  onlyPublic: boolean,
  config: ServiceConfig
): Effect.Effect<ReadonlyArray<ListEntry>, Unauthorized | StorageUnavailable, PlansStorageTag> {
  return Effect.gen(function* () {
    const caller = callerFromHeaders(authorization, config)

    if (caller.role !== 'owner') {
      return yield* new Unauthorized({})
    }

    const storage = yield* PlansStorageTag
    const entries = yield* storage.listDocuments()

    if (!onlyPublic) {
      return entries
    }

    return entries.filter((entry) => entry.isPublic)
  })
}

export function deleteDocument(
  idString: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  void,
  Unauthorized | StorageUnavailable | DocumentNotFound | PreconditionFailed | InvalidPlanId,
  PlansStorageTag
> {
  return Effect.gen(function* () {
    const caller = callerFromHeaders(authorization, config)

    if (caller.role !== 'owner') {
      return yield* new Unauthorized({})
    }

    const id = yield* parsePlanId(idString)
    const storage = yield* PlansStorageTag
    const isPublic = yield* storage.markerExists(id)

    if (isPublic) {
      return yield* new PreconditionFailed({ id })
    }

    yield* storage.headDocument(id)
    yield* storage.deleteDocument(id)
  })
}
