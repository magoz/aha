import { Effect } from 'effect'

import { isOwnerAuthorization } from './auth.js'
import type { ServiceConfig } from './config.js'
import {
  authorizeRead,
  deleteDocument,
  listDocuments,
  publishDocument,
  unpublishDocument,
  updateDocument,
  uploadDocument
} from './documents.js'
import type { ReaderCredentials } from './documents.js'
import type { DocumentNotFound, StorageUnavailable } from './errors.js'
import type { HeaderMap } from './headers.js'
import { isPlanId, isReservedDocumentName } from './plan-id.js'
import type { PlanId } from './plan-id.js'
import { withSecurityHeaders } from './security-headers.js'
import {
  completePairing,
  createPairing,
  isPairedBrowser,
  listSessions,
  revokeAllSessions,
  revokeSession,
  sessionCookie,
  sessionTokenFromCookies
} from './sessions.js'
import type { SessionStoreTag } from './sessions.js'
import { AhaStorageTag } from './storage.js'
import type { ByteStream, DocumentUpload } from './storage.js'

export interface AhaRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<HeaderMap>
  readonly body: ByteStream | null
}

export type ResponseBody = ByteStream | Uint8Array<ArrayBuffer> | null

export interface AhaResponse {
  readonly status: number
  readonly headers: HeaderMap
  readonly body: ResponseBody
}

type Route =
  | { readonly kind: 'root' }
  | { readonly kind: 'health' }
  | { readonly kind: 'invalid-id' }
  | { readonly kind: 'page'; readonly id: PlanId }
  | { readonly kind: 'documents' }
  | { readonly kind: 'document-api'; readonly id: PlanId }
  | { readonly kind: 'publish'; readonly id: PlanId }
  | { readonly kind: 'unpublish'; readonly id: PlanId }
  | { readonly kind: 'pairings' }
  | { readonly kind: 'pair-page'; readonly code: string }
  | { readonly kind: 'sessions' }
  | { readonly kind: 'session'; readonly id: string }

type Handled = Effect.Effect<AhaResponse, never, AhaStorageTag | SessionStoreTag>

const textEncoder = new TextEncoder()

// The pairing page is the only HTML the Worker writes itself: a script-free form posting to itself.
const PAIR_PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"

function headerValue(headers: Readonly<HeaderMap>, name: string): string | null {
  return headers[name.toLowerCase()] ?? null
}

function jsonResponse(status: number, json: string): AhaResponse {
  return {
    status,
    headers: withSecurityHeaders({ 'content-type': 'application/json; charset=utf-8' }),
    body: textEncoder.encode(json)
  }
}

function errorResponse(status: number, code: string): AhaResponse {
  return jsonResponse(status, JSON.stringify({ error: code }))
}

function textResponse(status: number, value: string): AhaResponse {
  return {
    status,
    headers: withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
    body: textEncoder.encode(value)
  }
}

function notFound(): AhaResponse {
  return textResponse(404, 'not found')
}

function storageUnavailable(): Effect.Effect<AhaResponse> {
  return Effect.succeed(errorResponse(502, 'storage-unavailable'))
}

function pairPage(status: number, title: string, body: string, extra: HeaderMap): AhaResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:28rem;margin:20vh auto;padding:0 1.5rem;color:#1a1a1a;background:#fafaf8}@media (prefers-color-scheme:dark){body{color:#eee;background:#161616}}h1{font-size:1.4rem;margin:0 0 .5rem}button{font:inherit;padding:.7rem 1.4rem;border:0;border-radius:.6rem;background:#2f5bea;color:#fff;cursor:pointer}</style></head><body>${body}</body></html>`

  return {
    status,
    headers: withSecurityHeaders({
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': PAIR_PAGE_CSP,
      ...extra
    }),
    body: textEncoder.encode(html)
  }
}

function hasSuspiciousEncoding(pathname: string): boolean {
  return pathname.includes('%') || pathname.includes('\\')
}

function splitPath(pathname: string): ReadonlyArray<string> | null {
  if (!pathname.startsWith('/') || hasSuspiciousEncoding(pathname) || pathname.includes('//')) {
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

  if (ifNoneMatch.trim() === '*') {
    return true
  }

  const normalized = normalizeEtag(etag)

  return ifNoneMatch.split(',').some((candidate) => normalizeEtag(candidate) === normalized)
}

function documentRoute(id: string | undefined, build: (id: PlanId) => Route): Route {
  return id !== undefined && isPlanId(id) ? build(id) : { kind: 'invalid-id' }
}

function routeFor(parts: ReadonlyArray<string>): Route | null {
  const [first, second, third, fourth] = parts

  if (first === undefined) {
    return { kind: 'root' }
  }

  if (parts.length === 1) {
    return isPlanId(first) && !isReservedDocumentName(first) ? { kind: 'page', id: first } : null
  }

  if (first === 'pair' && parts.length === 2 && second !== undefined) {
    return { kind: 'pair-page', code: second }
  }

  if (first !== 'api') {
    return null
  }

  if (parts.length === 2) {
    if (second === 'health') return { kind: 'health' }

    if (second === 'documents') return { kind: 'documents' }

    if (second === 'pair') return { kind: 'pairings' }

    if (second === 'sessions') return { kind: 'sessions' }

    return null
  }

  if (second === 'sessions' && parts.length === 3 && third !== undefined) {
    return { kind: 'session', id: third }
  }

  if (second !== 'documents') {
    return null
  }

  if (parts.length === 3) {
    return documentRoute(third, (id) => ({ kind: 'document-api', id }))
  }

  if (parts.length === 4 && fourth === 'publish') {
    return documentRoute(third, (id) => ({ kind: 'publish', id }))
  }

  if (parts.length === 4 && fourth === 'unpublish') {
    return documentRoute(third, (id) => ({ kind: 'unpublish', id }))
  }

  return null
}

function contentLengthHeader(headers: Readonly<HeaderMap>): number | null {
  const raw = headerValue(headers, 'content-length')

  if (raw === null || !/^\d+$/.test(raw.trim())) {
    return null
  }

  const parsed = Number.parseInt(raw.trim(), 10)

  return Number.isSafeInteger(parsed) ? parsed : null
}

function emptyStream(): ByteStream {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close()
    }
  })
}

// Uploads must declare their length so storage can enforce it while streaming.
function uploadOf(request: AhaRequest): DocumentUpload | null {
  const contentLength = contentLengthHeader(request.headers)

  if (contentLength === null) {
    return null
  }

  return { body: request.body ?? emptyStream(), contentLength }
}

export function handleAhaRequest(request: AhaRequest, config: ServiceConfig): Handled {
  const parsed = new URL(request.url, 'http://localhost')
  const parts = splitPath(parsed.pathname)
  const route = parts === null ? null : routeFor(parts)
  const method = request.method.toUpperCase()

  if (route === null) {
    return Effect.succeed(notFound())
  }

  switch (route.kind) {
    case 'root':
      return Effect.succeed(handleStatic(method, textResponse(200, 'aha')))
    case 'health':
      return Effect.succeed(handleStatic(method, jsonResponse(200, JSON.stringify({ ok: true }))))
    case 'invalid-id':
      return Effect.succeed(errorResponse(400, 'invalid-id'))
    case 'page':
      return handlePage(request, method, route.id, config)
    case 'documents':
      return handleDocumentCollection(request, method, parsed, config)
    case 'document-api':
      return handleDocumentApi(request, method, route.id, config)
    case 'publish':
      return handleVisibility(request, method, route.id, true, config)
    case 'unpublish':
      return handleVisibility(request, method, route.id, false, config)
    case 'pairings':
      return handlePairings(request, method, config)
    case 'pair-page':
      return handlePairPage(request, method, route.code)
    case 'sessions':
      return handleSessions(request, method, config)
    case 'session':
      return handleSession(request, method, route.id, config)
  }
}

function handleStatic(method: string, response: AhaResponse): AhaResponse {
  if (method === 'GET') {
    return response
  }

  if (method === 'HEAD') {
    return { ...response, body: null }
  }

  return errorResponse(405, 'method-not-allowed')
}

// Streams a document the caller may read. HEAD and conditional requests check metadata first, so
// neither opens the body unless it will be sent.
function streamDocument(
  id: PlanId,
  isHead: boolean,
  ifNoneMatch: string | null,
  extra: HeaderMap
): Effect.Effect<AhaResponse, StorageUnavailable | DocumentNotFound, AhaStorageTag> {
  return Effect.gen(function* () {
    const storage = yield* AhaStorageTag

    if (isHead || ifNoneMatch !== null) {
      const head = yield* storage.headDocument(id)

      if (etagMatches(ifNoneMatch, head.etag)) {
        return {
          status: 304,
          headers: withSecurityHeaders({ etag: head.etag, ...extra }),
          body: null
        }
      }
    }

    if (isHead) {
      const head = yield* storage.headDocument(id)

      return {
        status: 200,
        headers: withSecurityHeaders({
          'content-type': 'text/html; charset=utf-8',
          'content-length': String(head.contentLength),
          etag: head.etag,
          ...extra
        }),
        body: null
      }
    }

    const document = yield* storage.getDocument(id)

    return {
      status: 200,
      headers: withSecurityHeaders({
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(document.contentLength),
        etag: document.etag,
        ...extra
      }),
      body: document.body
    }
  })
}

function handlePage(
  request: AhaRequest,
  method: string,
  id: PlanId,
  config: ServiceConfig
): Handled {
  if (method !== 'GET' && method !== 'HEAD') {
    return Effect.succeed(errorResponse(405, 'method-not-allowed'))
  }

  const credentials: ReaderCredentials = {
    authorization: headerValue(request.headers, 'authorization'),
    sessionToken: sessionTokenFromCookies(headerValue(request.headers, 'cookie'))
  }

  return authorizeRead(id, credentials, config).pipe(
    Effect.flatMap((access) => {
      const renew: HeaderMap =
        access.grant === 'paired-browser'
          ? { 'set-cookie': sessionCookie(access.sessionToken) }
          : {}

      return streamDocument(
        access.id,
        method === 'HEAD',
        headerValue(request.headers, 'if-none-match'),
        renew
      )
    }),
    Effect.catchTag('StorageUnavailable', storageUnavailable),
    // Private, missing and invalid all look the same to someone without access.
    Effect.orElseSucceed(notFound)
  )
}

function handleDocumentCollection(
  request: AhaRequest,
  method: string,
  parsed: URL,
  config: ServiceConfig
): Handled {
  const authorization = headerValue(request.headers, 'authorization')

  if (method === 'GET') {
    return listDocuments(authorization, parsed.searchParams.get('public') === '1', config).pipe(
      Effect.map((entries) => jsonResponse(200, JSON.stringify(entries))),
      Effect.catchTag('StorageUnavailable', storageUnavailable),
      Effect.orElseSucceed(() => errorResponse(401, 'unauthorized'))
    )
  }

  if (method !== 'POST') {
    return Effect.succeed(errorResponse(405, 'method-not-allowed'))
  }

  return uploadDocument(
    parsed.searchParams.get('name'),
    uploadOf(request),
    headerValue(request.headers, 'content-type') ?? '',
    authorization,
    config
  ).pipe(
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
      Unauthorized: () => Effect.succeed(errorResponse(401, 'unauthorized')),
      UnsupportedMediaType: () => Effect.succeed(errorResponse(415, 'unsupported-media-type')),
      LengthRequired: () => Effect.succeed(errorResponse(411, 'length-required')),
      LengthMismatch: () => Effect.succeed(errorResponse(400, 'length-mismatch')),
      PayloadTooLarge: () => Effect.succeed(errorResponse(413, 'payload-too-large')),
      InvalidDocumentName: () => Effect.succeed(errorResponse(400, 'invalid-name')),
      DocumentExists: () => Effect.succeed(errorResponse(409, 'name-taken'))
    }),
    Effect.orElseSucceed(() => errorResponse(502, 'storage-unavailable'))
  )
}

function handleDocumentApi(
  request: AhaRequest,
  method: string,
  id: PlanId,
  config: ServiceConfig
): Handled {
  const authorization = headerValue(request.headers, 'authorization')

  if (method === 'GET' || method === 'HEAD') {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return Effect.succeed(errorResponse(401, 'unauthorized'))
    }

    return streamDocument(
      id,
      method === 'HEAD',
      headerValue(request.headers, 'if-none-match'),
      {}
    ).pipe(
      Effect.catchTags({
        StorageUnavailable: storageUnavailable,
        DocumentNotFound: () => Effect.succeed(errorResponse(404, 'not-found'))
      })
    )
  }

  if (method === 'PUT') {
    return updateDocument(
      id,
      uploadOf(request),
      headerValue(request.headers, 'content-type') ?? '',
      authorization,
      headerValue(request.headers, 'if-match'),
      config
    ).pipe(
      Effect.map((etag) => jsonResponse(200, JSON.stringify({ id, etag }))),
      Effect.catchTags({
        Unauthorized: () => Effect.succeed(errorResponse(401, 'unauthorized')),
        UnsupportedMediaType: () => Effect.succeed(errorResponse(415, 'unsupported-media-type')),
        LengthRequired: () => Effect.succeed(errorResponse(411, 'length-required')),
        LengthMismatch: () => Effect.succeed(errorResponse(400, 'length-mismatch')),
        PayloadTooLarge: () => Effect.succeed(errorResponse(413, 'payload-too-large')),
        DocumentNotFound: () => Effect.succeed(errorResponse(404, 'not-found')),
        PreconditionFailed: () => Effect.succeed(errorResponse(412, 'precondition-failed'))
      }),
      Effect.orElseSucceed(() => errorResponse(502, 'storage-unavailable'))
    )
  }

  if (method === 'DELETE') {
    return deleteDocument(id, authorization, config).pipe(
      Effect.map(() => jsonResponse(200, JSON.stringify({ id, deleted: true }))),
      Effect.catchTags({
        Unauthorized: () => Effect.succeed(errorResponse(401, 'unauthorized')),
        DocumentNotFound: () => Effect.succeed(errorResponse(404, 'not-found')),
        PreconditionFailed: () => Effect.succeed(errorResponse(409, 'published'))
      }),
      Effect.orElseSucceed(() => errorResponse(502, 'storage-unavailable'))
    )
  }

  return Effect.succeed(errorResponse(405, 'method-not-allowed'))
}

function handleVisibility(
  request: AhaRequest,
  method: string,
  id: PlanId,
  publish: boolean,
  config: ServiceConfig
): Handled {
  if (method !== 'POST') {
    return Effect.succeed(errorResponse(405, 'method-not-allowed'))
  }

  const authorization = headerValue(request.headers, 'authorization')

  const action = publish
    ? publishDocument(id, authorization, config)
    : unpublishDocument(id, authorization, config)

  return action.pipe(
    Effect.map(() => jsonResponse(200, JSON.stringify({ id, public: publish }))),
    Effect.catchTags({
      Unauthorized: () => Effect.succeed(errorResponse(401, 'unauthorized')),
      DocumentNotFound: () => Effect.succeed(errorResponse(404, 'not-found'))
    }),
    Effect.orElseSucceed(() => errorResponse(502, 'storage-unavailable'))
  )
}

function handlePairings(request: AhaRequest, method: string, config: ServiceConfig): Handled {
  if (method !== 'POST') {
    return Effect.succeed(errorResponse(405, 'method-not-allowed'))
  }

  return createPairing(headerValue(request.headers, 'authorization'), config).pipe(
    Effect.map((pairing) =>
      jsonResponse(
        201,
        JSON.stringify({
          url: `${config.publicUrl}/pair/${pairing.code}`,
          expiresAt: new Date(pairing.expiresAt).toISOString()
        })
      )
    ),
    Effect.catchTag('Unauthorized', () => Effect.succeed(errorResponse(401, 'unauthorized'))),
    Effect.catchTag('StorageUnavailable', storageUnavailable)
  )
}

function pairedPage(): AhaResponse {
  return pairPage(
    200,
    'Browser paired',
    '<h1>Browser paired</h1><p>Private Aha pages now open in this browser.</p>',
    {}
  )
}

// GET only shows a button, so link previews in chat apps cannot use up the code. POST pairs and
// redirects back to GET, which then shows "paired" (a refresh never re-posts a used code).
function handlePairPage(request: AhaRequest, method: string, code: string): Handled {
  if (method === 'GET' || method === 'HEAD') {
    const token = sessionTokenFromCookies(headerValue(request.headers, 'cookie'))
    const alreadyPaired = token === null ? Effect.succeed(false) : isPairedBrowser(token)

    return alreadyPaired.pipe(
      Effect.map((paired) =>
        paired
          ? pairedPage()
          : pairPage(
              200,
              'Pair this browser',
              '<h1>Pair this browser</h1><p>This browser will be able to open your private Aha pages.</p><form method="post"><button type="submit">Pair this browser</button></form>',
              {}
            )
      ),
      Effect.map((page) => (method === 'HEAD' ? { ...page, body: null } : page)),
      Effect.catchTag('StorageUnavailable', storageUnavailable)
    )
  }

  if (method !== 'POST') {
    return Effect.succeed(errorResponse(405, 'method-not-allowed'))
  }

  return completePairing(code, headerValue(request.headers, 'user-agent')).pipe(
    Effect.map((token): AhaResponse => ({
      status: 303,
      headers: withSecurityHeaders({
        location: `/pair/${code}`,
        'set-cookie': sessionCookie(token)
      }),
      body: null
    })),
    Effect.catchTag('PairingInvalid', () =>
      Effect.succeed(
        pairPage(
          410,
          'Link expired',
          '<h1>Link expired</h1><p>This pairing link was already used or has expired. Run <code>aha pair</code> again.</p>',
          {}
        )
      )
    ),
    Effect.catchTag('StorageUnavailable', storageUnavailable)
  )
}

function handleSessions(request: AhaRequest, method: string, config: ServiceConfig): Handled {
  const authorization = headerValue(request.headers, 'authorization')

  if (method === 'GET') {
    return listSessions(authorization, config).pipe(
      Effect.map((sessions) => jsonResponse(200, JSON.stringify(sessions))),
      Effect.catchTag('Unauthorized', () => Effect.succeed(errorResponse(401, 'unauthorized'))),
      Effect.catchTag('StorageUnavailable', storageUnavailable)
    )
  }

  if (method === 'DELETE') {
    return revokeAllSessions(authorization, config).pipe(
      Effect.map((revoked) => jsonResponse(200, JSON.stringify({ revoked }))),
      Effect.catchTag('Unauthorized', () => Effect.succeed(errorResponse(401, 'unauthorized'))),
      Effect.catchTag('StorageUnavailable', storageUnavailable)
    )
  }

  return Effect.succeed(errorResponse(405, 'method-not-allowed'))
}

function handleSession(
  request: AhaRequest,
  method: string,
  id: string,
  config: ServiceConfig
): Handled {
  if (method !== 'DELETE') {
    return Effect.succeed(errorResponse(405, 'method-not-allowed'))
  }

  return revokeSession(id, headerValue(request.headers, 'authorization'), config).pipe(
    Effect.map(() => jsonResponse(200, JSON.stringify({ id, revoked: true }))),
    Effect.catchTags({
      Unauthorized: () => Effect.succeed(errorResponse(401, 'unauthorized')),
      SessionNotFound: () => Effect.succeed(errorResponse(404, 'not-found'))
    }),
    Effect.catchTag('StorageUnavailable', storageUnavailable)
  )
}
