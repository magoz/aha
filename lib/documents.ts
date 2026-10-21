import { Effect } from 'effect'

import { isOwnerAuthorization } from './auth.js'
import type { ServiceConfig } from './config.js'
import {
  DocumentExists,
  DocumentNotFound,
  LengthRequired,
  PayloadTooLarge,
  PreconditionFailed,
  StorageUnavailable,
  Unauthorized,
  UnsupportedMediaType
} from './errors.js'
import { HTML_CONTENT_TYPE, MAX_HTML_BYTES, isHtmlContentType } from './html-limits.js'
import { InvalidDocumentName, parseNewDocumentName, parsePlanId } from './plan-id.js'
import type { InvalidPlanId, PlanId } from './plan-id.js'
import { isPairedBrowser } from './sessions.js'
import type { SessionStoreTag } from './sessions.js'
import { AhaStorageTag } from './storage.js'
import type { DocumentUpload, ListEntry } from './storage.js'

export interface UploadResult {
  readonly id: PlanId
  readonly etag: string
}

// What a page request carries: the owner bearer (CLI) and/or the paired-browser cookie token.
export interface ReaderCredentials {
  readonly authorization: string | null
  readonly sessionToken: string | null
}

// How a read was allowed. A paired-browser grant carries its token so the cookie can be renewed.
export type ReadAccess =
  | { readonly grant: 'owner'; readonly id: PlanId }
  | { readonly grant: 'paired-browser'; readonly id: PlanId; readonly sessionToken: string }
  | { readonly grant: 'public'; readonly id: PlanId }

function checkUpload(
  upload: DocumentUpload | null,
  contentType: string
): Effect.Effect<DocumentUpload, UnsupportedMediaType | LengthRequired | PayloadTooLarge> {
  if (!isHtmlContentType(contentType)) {
    return Effect.fail(new UnsupportedMediaType({ contentType }))
  }

  if (upload === null) {
    return Effect.fail(new LengthRequired({}))
  }

  if (upload.contentLength > MAX_HTML_BYTES) {
    return Effect.fail(new PayloadTooLarge({ limitBytes: MAX_HTML_BYTES }))
  }

  return Effect.succeed(upload)
}

export function uploadDocument(
  name: string | null,
  upload: DocumentUpload | null,
  contentType: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  UploadResult,
  | Unauthorized
  | UnsupportedMediaType
  | LengthRequired
  | PayloadTooLarge
  | InvalidDocumentName
  | StorageUnavailable
  | PreconditionFailed
  | DocumentExists,
  AhaStorageTag
> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const checked = yield* checkUpload(upload, contentType)

    if (name === null) {
      return yield* new InvalidDocumentName({ value: '' })
    }

    const id = yield* parseNewDocumentName(name)
    const storage = yield* AhaStorageTag

    // A leftover marker (e.g. a publish racing a delete) would make a reused name public on
    // upload. Treat it as taken; a failed check fails closed.
    if (yield* storage.markerExists(id)) {
      return yield* new DocumentExists({ id })
    }

    const etag = yield* storage.putDocument(id, checked, {
      ifMatch: null,
      createOnly: true,
      contentType: HTML_CONTENT_TYPE
    })

    return { id, etag }
  })
}

export function updateDocument(
  idString: string,
  upload: DocumentUpload | null,
  contentType: string,
  authorization: string | null,
  ifMatch: string | null,
  config: ServiceConfig
): Effect.Effect<
  string,
  | Unauthorized
  | UnsupportedMediaType
  | LengthRequired
  | PayloadTooLarge
  | StorageUnavailable
  | DocumentNotFound
  | PreconditionFailed
  | DocumentExists
  | InvalidPlanId,
  AhaStorageTag
> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const checked = yield* checkUpload(upload, contentType)
    const id = yield* parsePlanId(idString)
    const storage = yield* AhaStorageTag
    yield* storage.headDocument(id)

    return yield* storage.putDocument(id, checked, {
      ifMatch,
      createOnly: false,
      contentType: HTML_CONTENT_TYPE
    })
  })
}

// Decides whether a page may be read; the caller then streams it. The owner and paired browsers
// read any document; everyone else needs the publication marker. Storage failures fail closed.
export function authorizeRead(
  idString: string,
  credentials: ReaderCredentials,
  config: ServiceConfig
): Effect.Effect<
  ReadAccess,
  Unauthorized | StorageUnavailable | InvalidPlanId,
  AhaStorageTag | SessionStoreTag
> {
  return Effect.gen(function* () {
    const id = yield* parsePlanId(idString)

    if (isOwnerAuthorization(credentials.authorization, config.ownerToken)) {
      return { id, grant: 'owner' as const }
    }

    const sessionToken = credentials.sessionToken

    if (sessionToken !== null && (yield* isPairedBrowser(sessionToken))) {
      return { id, grant: 'paired-browser' as const, sessionToken }
    }

    const storage = yield* AhaStorageTag

    if (!(yield* storage.markerExists(id))) {
      return yield* new Unauthorized({})
    }

    return { id, grant: 'public' as const }
  })
}

export function publishDocument(
  idString: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  void,
  Unauthorized | StorageUnavailable | DocumentNotFound | InvalidPlanId,
  AhaStorageTag
> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const id = yield* parsePlanId(idString)
    const storage = yield* AhaStorageTag
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
  AhaStorageTag
> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const id = yield* parsePlanId(idString)
    const storage = yield* AhaStorageTag
    // Remove the marker first so a leftover marker without a document can still be cleared;
    // removing a marker never exposes anything.
    yield* storage.deleteMarker(id)
    yield* storage.headDocument(id)
  })
}

export function listDocuments(
  authorization: string | null,
  onlyPublic: boolean,
  config: ServiceConfig
): Effect.Effect<ReadonlyArray<ListEntry>, Unauthorized | StorageUnavailable, AhaStorageTag> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const storage = yield* AhaStorageTag
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
  AhaStorageTag
> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const id = yield* parsePlanId(idString)
    const storage = yield* AhaStorageTag
    const isPublic = yield* storage.markerExists(id)

    if (isPublic) {
      return yield* new PreconditionFailed({ id })
    }

    yield* storage.headDocument(id)
    yield* storage.deleteDocument(id)
  })
}
