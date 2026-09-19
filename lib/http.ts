import { Effect } from 'effect'

import type { ServiceConfig } from './config.js'
import {
  deleteDocument,
  listDocuments,
  publishDocument,
  readDocumentWithAccess,
  unpublishDocument,
  updateDocument,
  uploadDocument
} from './documents.js'
import { MAX_HTML_BYTES } from './html-limits.js'
import { isPlanId } from './plan-id.js'
import { withSecurityHeaders } from './security-headers.js'
import type { HeaderMap } from './headers.js'
import { PlansStorageTag } from './storage.js'

export interface PlansRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<HeaderMap>
  readonly body: Uint8Array | null
}

export interface PlansResponse {
  readonly status: number
  readonly headers: HeaderMap
  readonly body: Uint8Array | null
}

interface RouteTarget {
  readonly kind: string
  readonly id: string | null
}

const textEncoder = new TextEncoder()

function headerValue(headers: Readonly<HeaderMap>, name: string): string | null {
  const value = headers[name.toLowerCase()]

  if (value === undefined) {
    return null
  }

  return value
}

function jsonResponse(status: number, value: string): PlansResponse {
  return {
    status,
    headers: withSecurityHeaders({ 'content-type': 'application/json; charset=utf-8' }),
    body: textEncoder.encode(value)
  }
}

function textResponse(status: number, value: string): PlansResponse {
  return {
    status,
    headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
    body: textEncoder.encode(value)
  }
}

function errorJson(code: string): string {
  return JSON.stringify({ error: code })
}

function hasSuspiciousEncoding(pathname: string): boolean {
  return pathname.includes('%') || pathname.includes('\\')
}

function splitPath(pathname: string): ReadonlyArray<string> | null {
  if (!pathname.startsWith('/')) {
    return null
  }

  if (hasSuspiciousEncoding(pathname)) {
    return null
  }

  if (pathname.includes('//')) {
    return null
  }

  const trimmed = pathname === '/' ? '' : pathname.replace(/\/$/, '')

  if (trimmed === '') {
    return []
  }

  const parts = trimmed.slice(1).split('/')

  for (const part of parts) {
    if (part.length === 0 || part === '.' || part === '..') {
      return null
    }
  }

  return parts
}

function normalizeEtag(value: string): string {
  const trimmed = value.trim()
  const withoutWeak = trimmed.startsWith('W/') ? trimmed.slice(2) : trimmed

  if (withoutWeak.length >= 2 && withoutWeak.startsWith('"') && withoutWeak.endsWith('"')) {
    return withoutWeak.slice(1, withoutWeak.length - 1)
  }

  return withoutWeak
}

function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (ifNoneMatch === null) {
    return false
  }

  const normalized = normalizeEtag(etag)

  if (ifNoneMatch.trim() === '*') {
    return true
  }

  const candidates = ifNoneMatch.split(',')

  for (const candidate of candidates) {
    if (normalizeEtag(candidate) === normalized) {
      return true
    }
  }

  return false
}

function routeFor(parts: ReadonlyArray<string>): RouteTarget | null {
  if (parts.length === 0) {
    return { kind: 'root', id: null }
  }

  if (parts.length === 1) {
    const only = parts[0]

    if (only === undefined) {
      return null
    }

    if (isPlanId(only)) {
      return { kind: 'public-document', id: only }
    }

    return null
  }

  const first = parts[0]
  const second = parts[1]

  if (first === undefined || second === undefined) {
    return null
  }

  if (first !== 'api') {
    return null
  }

  if (second === 'health' && parts.length === 2) {
    return { kind: 'health', id: null }
  }

  if (second === 'documents' && parts.length === 2) {
    return { kind: 'documents', id: null }
  }

  if (second === 'documents' && parts.length === 3) {
    const third = parts[2]

    if (third === undefined || !isPlanId(third)) {
      return { kind: 'invalid-id', id: null }
    }

    return { kind: 'document-api', id: third }
  }

  if (second === 'documents' && parts.length === 4) {
    const third = parts[2]
    const fourth = parts[3]

    if (third === undefined || fourth === undefined || !isPlanId(third)) {
      return { kind: 'invalid-id', id: null }
    }

    if (fourth === 'publish') {
      return { kind: 'publish', id: third }
    }

    if (fourth === 'unpublish') {
      return { kind: 'unpublish', id: third }
    }
  }

  return null
}

function contentLengthHeader(headers: Readonly<HeaderMap>): number | null {
  const raw = headerValue(headers, 'content-length')

  if (raw === null || raw.trim().length === 0) {
    return null
  }

  const parsed = Number.parseInt(raw.trim(), 10)

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

export function handlePlansRequest(
  request: PlansRequest,
  config: ServiceConfig
): Effect.Effect<PlansResponse, never, PlansStorageTag> {
  const parsed = new URL(request.url, 'http://localhost')
  const parts = splitPath(parsed.pathname)

  if (parts === null) {
    return Effect.succeed(textResponse(404, 'not found'))
  }

  const route = routeFor(parts)

  if (route === null) {
    return Effect.succeed(textResponse(404, 'not found'))
  }

  if (route.kind === 'root') {
    return Effect.succeed(handleRoot(request.method))
  }

  if (route.kind === 'health') {
    return Effect.succeed(handleHealth(request.method))
  }

  if (route.kind === 'invalid-id') {
    return Effect.succeed(jsonResponse(400, errorJson('invalid-id')))
  }

  if (route.kind === 'public-document') {
    return handlePublicDocument(request, route.id, config)
  }

  if (route.kind === 'documents') {
    return handleDocumentCollection(request, parsed, config)
  }

  if (route.kind === 'document-api') {
    return handleDocumentApi(request, route.id, config)
  }

  if (route.kind === 'publish') {
    return handleVisibility(request, route.id, true, config)
  }

  if (route.kind === 'unpublish') {
    return handleVisibility(request, route.id, false, config)
  }

  return Effect.succeed(textResponse(404, 'not found'))
}

function handleRoot(method: string): PlansResponse {
  const upper = method.toUpperCase()

  if (upper !== 'GET' && upper !== 'HEAD') {
    return jsonResponse(405, errorJson('method-not-allowed'))
  }

  if (upper === 'HEAD') {
    return {
      status: 200,
      headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
      body: null
    }
  }

  return textResponse(200, 'plans')
}

function handleHealth(method: string): PlansResponse {
  const upper = method.toUpperCase()

  if (upper !== 'GET' && upper !== 'HEAD') {
    return jsonResponse(405, errorJson('method-not-allowed'))
  }

  if (upper === 'HEAD') {
    return {
      status: 200,
      headers: withSecurityHeaders({ 'content-type': 'application/json; charset=utf-8' }),
      body: null
    }
  }

  return jsonResponse(200, JSON.stringify({ ok: true }))
}

function handlePublicDocument(
  request: PlansRequest,
  id: string | null,
  config: ServiceConfig
): Effect.Effect<PlansResponse, never, PlansStorageTag> {
  const method = request.method.toUpperCase()

  if (id === null) {
    return Effect.succeed(textResponse(404, 'not found'))
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return Effect.succeed(jsonResponse(405, errorJson('method-not-allowed')))
  }

  const authorization = headerValue(request.headers, 'authorization')
  const ifNoneMatch = headerValue(request.headers, 'if-none-match')
  const isHead = method === 'HEAD'
  const documentId = id

  return readDocumentWithAccess(documentId, authorization, config).pipe(
    Effect.map((result) => {
      if (etagMatches(ifNoneMatch, result.document.etag)) {
        return {
          status: 304,
          headers: withSecurityHeaders({ etag: result.document.etag }),
          body: null
        }
      }

      const headers = withSecurityHeaders({
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(result.document.body.length),
        etag: result.document.etag
      })

      if (isHead) {
        return { status: 200, headers, body: null }
      }

      return { status: 200, headers, body: result.document.body }
    }),
    Effect.catchTag('StorageUnavailable', () =>
      Effect.succeed(jsonResponse(502, errorJson('storage-unavailable')))
    ),
    Effect.orElseSucceed(() => textResponse(404, 'not found'))
  )
}

function handleDocumentCollection(
  request: PlansRequest,
  parsed: URL,
  config: ServiceConfig
): Effect.Effect<PlansResponse, never, PlansStorageTag> {
  const method = request.method.toUpperCase()
  const authorization = headerValue(request.headers, 'authorization')

  if (method === 'GET') {
    const onlyPublic = parsed.searchParams.get('public') === '1'

    return listDocuments(authorization, onlyPublic, config).pipe(
      Effect.map((entries) => jsonResponse(200, JSON.stringify(entries))),
      Effect.catchTag('StorageUnavailable', () =>
        Effect.succeed(jsonResponse(502, errorJson('storage-unavailable')))
      ),
      Effect.orElseSucceed(() => jsonResponse(401, errorJson('unauthorized')))
    )
  }

  if (method === 'POST') {
    const declared = contentLengthHeader(request.headers)

    if (declared !== null && declared > MAX_HTML_BYTES) {
      return Effect.succeed(jsonResponse(413, errorJson('payload-too-large')))
    }

    const contentType = headerValue(request.headers, 'content-type') ?? ''
    const body = request.body ?? new Uint8Array(0)

    return uploadDocument(body, contentType, authorization, config).pipe(
      Effect.map((created) =>
        jsonResponse(
          201,
          JSON.stringify({
            id: created.id,
            url: `${config.publicUrl}/${created.id}`,
            etag: created.etag
          })
        )
      ),
      Effect.catchTags({
        Unauthorized: () => Effect.succeed(jsonResponse(401, errorJson('unauthorized'))),
        UnsupportedMediaType: () =>
          Effect.succeed(jsonResponse(415, errorJson('unsupported-media-type'))),
        PayloadTooLarge: () => Effect.succeed(jsonResponse(413, errorJson('payload-too-large')))
      }),
      Effect.orElseSucceed(() => jsonResponse(502, errorJson('storage-unavailable')))
    )
  }

  return Effect.succeed(jsonResponse(405, errorJson('method-not-allowed')))
}

function handleDocumentApi(
  request: PlansRequest,
  id: string | null,
  config: ServiceConfig
): Effect.Effect<PlansResponse, never, PlansStorageTag> {
  const method = request.method.toUpperCase()

  if (id === null) {
    return Effect.succeed(jsonResponse(400, errorJson('invalid-id')))
  }

  const authorization = headerValue(request.headers, 'authorization')
  const documentId = id

  if (method === 'GET' || method === 'HEAD') {
    const ifNoneMatch = headerValue(request.headers, 'if-none-match')
    const isHead = method === 'HEAD'

    return readDocumentWithAccess(documentId, authorization, config).pipe(
      Effect.map((result) => {
        if (etagMatches(ifNoneMatch, result.document.etag)) {
          return {
            status: 304,
            headers: withSecurityHeaders({ etag: result.document.etag }),
            body: null
          }
        }

        const headers = withSecurityHeaders({
          'content-type': 'text/html; charset=utf-8',
          'content-length': String(result.document.body.length),
          etag: result.document.etag
        })

        if (isHead) {
          return { status: 200, headers, body: null }
        }

        return { status: 200, headers, body: result.document.body }
      }),
      Effect.catchTags({
        StorageUnavailable: () =>
          Effect.succeed(jsonResponse(502, errorJson('storage-unavailable'))),
        DocumentNotFound: () => Effect.succeed(jsonResponse(404, errorJson('not-found')))
      }),
      Effect.orElseSucceed(() => jsonResponse(401, errorJson('unauthorized')))
    )
  }

  if (method === 'PUT') {
    const declared = contentLengthHeader(request.headers)

    if (declared !== null && declared > MAX_HTML_BYTES) {
      return Effect.succeed(jsonResponse(413, errorJson('payload-too-large')))
    }

    const contentType = headerValue(request.headers, 'content-type') ?? ''
    const ifMatch = headerValue(request.headers, 'if-match')
    const body = request.body ?? new Uint8Array(0)

    return updateDocument(documentId, body, contentType, authorization, ifMatch, config).pipe(
      Effect.map((etag) => jsonResponse(200, JSON.stringify({ id: documentId, etag }))),
      Effect.catchTags({
        Unauthorized: () => Effect.succeed(jsonResponse(401, errorJson('unauthorized'))),
        UnsupportedMediaType: () =>
          Effect.succeed(jsonResponse(415, errorJson('unsupported-media-type'))),
        PayloadTooLarge: () => Effect.succeed(jsonResponse(413, errorJson('payload-too-large'))),
        DocumentNotFound: () => Effect.succeed(jsonResponse(404, errorJson('not-found'))),
        PreconditionFailed: () =>
          Effect.succeed(jsonResponse(412, errorJson('precondition-failed')))
      }),
      Effect.orElseSucceed(() => jsonResponse(502, errorJson('storage-unavailable')))
    )
  }

  if (method === 'DELETE') {
    return deleteDocument(documentId, authorization, config).pipe(
      Effect.map(() => jsonResponse(200, JSON.stringify({ id: documentId, deleted: true }))),
      Effect.catchTags({
        Unauthorized: () => Effect.succeed(jsonResponse(401, errorJson('unauthorized'))),
        DocumentNotFound: () => Effect.succeed(jsonResponse(404, errorJson('not-found'))),
        PreconditionFailed: () => Effect.succeed(jsonResponse(409, errorJson('published')))
      }),
      Effect.orElseSucceed(() => jsonResponse(502, errorJson('storage-unavailable')))
    )
  }

  return Effect.succeed(jsonResponse(405, errorJson('method-not-allowed')))
}

function handleVisibility(
  request: PlansRequest,
  id: string | null,
  publish: boolean,
  config: ServiceConfig
): Effect.Effect<PlansResponse, never, PlansStorageTag> {
  const method = request.method.toUpperCase()

  if (id === null) {
    return Effect.succeed(jsonResponse(400, errorJson('invalid-id')))
  }

  if (method !== 'POST') {
    return Effect.succeed(jsonResponse(405, errorJson('method-not-allowed')))
  }

  const authorization = headerValue(request.headers, 'authorization')
  const documentId = id

  const action = publish
    ? publishDocument(documentId, authorization, config)
    : unpublishDocument(documentId, authorization, config)

  return action.pipe(
    Effect.map(() => jsonResponse(200, JSON.stringify({ id: documentId, public: publish }))),
    Effect.catchTags({
      Unauthorized: () => Effect.succeed(jsonResponse(401, errorJson('unauthorized'))),
      DocumentNotFound: () => Effect.succeed(jsonResponse(404, errorJson('not-found')))
    }),
    Effect.orElseSucceed(() => jsonResponse(502, errorJson('storage-unavailable')))
  )
}
