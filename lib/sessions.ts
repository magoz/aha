import { Clock, Context, Effect, Schema } from 'effect'

import { isOwnerAuthorization } from './auth.js'
import type { ServiceConfig } from './config.js'
import { PairingInvalid, SessionNotFound, StorageUnavailable, Unauthorized } from './errors.js'

// Browser pairing: the owner asks for a one-time link, opening it on a device stores a random
// session token in a cookie, and that browser can then read private pages. Storage only ever holds
// SHA-256 hashes of codes and tokens, so a leaked listing cannot be replayed as a cookie.

export const PAIRING_TTL_MS = 10 * 60 * 1000

export const SESSION_COOKIE = '__Host-aha-session'

// Browsers cap cookie lifetime at 400 days; the cookie is renewed on every private view.
export const SESSION_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

const CODE_BYTES = 16

const TOKEN_BYTES = 32

const CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

const SESSION_ID_PATTERN = /^[0-9a-f]{64}$/

export const SessionIdSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(SESSION_ID_PATTERN)),
  Schema.brand('SessionId')
)

export type SessionId = Schema.Schema.Type<typeof SessionIdSchema>

export const isSessionId = Schema.is(SessionIdSchema)

export interface BrowserSession {
  readonly id: SessionId
  readonly label: string
  readonly createdAt: string
}

export interface Pairing {
  readonly code: string
  readonly expiresAt: number
}

export interface SessionStore {
  readonly putPairing: (
    codeHash: string,
    expiresAt: number
  ) => Effect.Effect<void, StorageUnavailable>
  // Removes the pairing and returns its expiry, or null when there was none.
  readonly takePairing: (codeHash: string) => Effect.Effect<number | null, StorageUnavailable>
  readonly putSession: (session: BrowserSession) => Effect.Effect<void, StorageUnavailable>
  readonly sessionExists: (id: SessionId) => Effect.Effect<boolean, StorageUnavailable>
  readonly listSessions: () => Effect.Effect<ReadonlyArray<BrowserSession>, StorageUnavailable>
  readonly deleteSession: (
    id: SessionId
  ) => Effect.Effect<void, StorageUnavailable | SessionNotFound>
}

export class SessionStoreTag extends Context.Service<SessionStoreTag, SessionStore>()(
  'SessionStore'
) {}

function base64Url(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function randomToken(byteCount: number): string {
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)

  return base64Url(bytes)
}

function sha256Hex(value: string): Effect.Effect<string> {
  return Effect.promise(() =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  ).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    )
  )
}

function sessionIdFor(token: string): Effect.Effect<SessionId, StorageUnavailable> {
  return sha256Hex(token).pipe(
    Effect.flatMap((hex) =>
      isSessionId(hex)
        ? Effect.succeed(hex)
        : Effect.fail(new StorageUnavailable({ operation: 'sessionIdFor' }))
    )
  )
}

function browserName(userAgent: string): string | null {
  if (userAgent.includes('Edg/')) return 'Edge'

  if (userAgent.includes('Firefox/') || userAgent.includes('FxiOS/')) return 'Firefox'

  if (userAgent.includes('Chrome/') || userAgent.includes('CriOS/')) return 'Chrome'

  if (userAgent.includes('Safari/')) return 'Safari'

  return null
}

function systemName(userAgent: string): string | null {
  if (userAgent.includes('iPhone')) return 'iPhone'

  if (userAgent.includes('iPad')) return 'iPad'

  if (userAgent.includes('Android')) return 'Android'

  if (userAgent.includes('Mac OS X')) return 'macOS'

  if (userAgent.includes('Windows')) return 'Windows'

  if (userAgent.includes('Linux')) return 'Linux'

  return null
}

// A human label for `aha devices`, e.g. "Safari on iPhone". Never used for access decisions.
export function labelFromUserAgent(userAgent: string | null): string {
  if (userAgent === null) {
    return 'Browser'
  }

  const browser = browserName(userAgent)
  const system = systemName(userAgent)

  if (browser !== null && system !== null) return `${browser} on ${system}`

  return browser ?? system ?? 'Browser'
}

export function sessionTokenFromCookies(cookieHeader: string | null): string | null {
  if (cookieHeader === null) {
    return null
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')

    if (separator === -1 || part.slice(0, separator).trim() !== SESSION_COOKIE) {
      continue
    }

    const value = part.slice(separator + 1).trim()

    return TOKEN_PATTERN.test(value) ? value : null
  }

  return null
}

// `SameSite=Lax` so a private link opened from another app still carries the cookie; subresource
// and script requests from other sites (and from sandboxed pages, whose origin is opaque) do not.
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Max-Age=${String(SESSION_COOKIE_MAX_AGE_SECONDS)}; Path=/; Secure; HttpOnly; SameSite=Lax`
}

export function isPairingCode(value: string): boolean {
  return CODE_PATTERN.test(value)
}

export function createPairing(
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<Pairing, Unauthorized | StorageUnavailable, SessionStoreTag> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const store = yield* SessionStoreTag
    const code = randomToken(CODE_BYTES)
    const expiresAt = (yield* Clock.currentTimeMillis) + PAIRING_TTL_MS
    yield* store.putPairing(yield* sha256Hex(code), expiresAt)

    return { code, expiresAt }
  })
}

// Uses up the code (even when expired) and returns the new session token for the cookie.
export function completePairing(
  code: string,
  userAgent: string | null
): Effect.Effect<string, PairingInvalid | StorageUnavailable, SessionStoreTag> {
  return Effect.gen(function* () {
    if (!isPairingCode(code)) {
      return yield* new PairingInvalid({})
    }

    const store = yield* SessionStoreTag
    const expiresAt = yield* store.takePairing(yield* sha256Hex(code))
    const now = yield* Clock.currentTimeMillis

    if (expiresAt === null || expiresAt < now) {
      return yield* new PairingInvalid({})
    }

    const token = randomToken(TOKEN_BYTES)

    yield* store.putSession({
      id: yield* sessionIdFor(token),
      label: labelFromUserAgent(userAgent),
      createdAt: new Date(now).toISOString()
    })

    return token
  })
}

export function isPairedBrowser(
  token: string | null
): Effect.Effect<boolean, StorageUnavailable, SessionStoreTag> {
  return Effect.gen(function* () {
    if (token === null || !TOKEN_PATTERN.test(token)) {
      return false
    }

    const store = yield* SessionStoreTag

    return yield* store.sessionExists(yield* sessionIdFor(token))
  })
}

export function listSessions(
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<
  ReadonlyArray<BrowserSession>,
  Unauthorized | StorageUnavailable,
  SessionStoreTag
> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const store = yield* SessionStoreTag

    return yield* store.listSessions()
  })
}

export function revokeSession(
  idString: string,
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<void, Unauthorized | StorageUnavailable | SessionNotFound, SessionStoreTag> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    if (!isSessionId(idString)) {
      return yield* new SessionNotFound({ id: idString })
    }

    const store = yield* SessionStoreTag
    yield* store.deleteSession(idString)
  })
}

export function revokeAllSessions(
  authorization: string | null,
  config: ServiceConfig
): Effect.Effect<number, Unauthorized | StorageUnavailable, SessionStoreTag> {
  return Effect.gen(function* () {
    if (!isOwnerAuthorization(authorization, config.ownerToken)) {
      return yield* new Unauthorized({})
    }

    const store = yield* SessionStoreTag
    const sessions = yield* store.listSessions()

    yield* Effect.forEach(sessions, (session) =>
      store.deleteSession(session.id).pipe(Effect.catchTag('SessionNotFound', () => Effect.void))
    )

    return sessions.length
  })
}
