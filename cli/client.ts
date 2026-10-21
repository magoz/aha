import { Effect, Schema } from 'effect'
import { readFile, writeFile } from 'node:fs/promises'
import { renderUnicodeCompact } from 'uqr'

import type { HeaderMap } from '../lib/headers.js'
import { MAX_HTML_BYTES } from '../lib/html-limits.js'
import { PlanIdSchema } from '../lib/plan-id.js'
import { SessionIdSchema } from '../lib/sessions.js'
import { deriveDocumentName } from './document-name.js'
import type {
  BuildRequest,
  CliRequest,
  ComponentsRequest,
  DevicesRequest,
  PairRequest,
  UnpairRequest
} from './parser.js'
import { CliUsageError } from './parser.js'

const ListItemSchema = Schema.Struct({
  id: PlanIdSchema,
  isPublic: Schema.Boolean,
  etag: Schema.String
})

const ListResponseSchema = Schema.Array(ListItemSchema)

const PairingResponseSchema = Schema.Struct({ url: Schema.String, expiresAt: Schema.String })

const SessionSchema = Schema.Struct({
  id: SessionIdSchema,
  label: Schema.String,
  createdAt: Schema.String
})

const SessionsResponseSchema = Schema.Array(SessionSchema)

type Session = Schema.Schema.Type<typeof SessionSchema>

export class CliRequestError extends Schema.TaggedError<CliRequestError>()('CliRequestError', {
  message: Schema.String
}) {}

function authHeaders(token: string): HeaderMap {
  return { authorization: `Bearer ${token}` }
}

function requestError(message: string): Effect.Effect<never, CliRequestError> {
  return Effect.fail(new CliRequestError({ message }))
}

function apiUrl(endpoint: string, path: string): string {
  return `${endpoint}${path}`
}

function formatListJson(entries: ReadonlyArray<string>): string {
  return JSON.stringify(entries, null, 2)
}

function formatListText(ids: ReadonlyArray<string>): string {
  return ids.join('\n')
}

type DecodedList = Schema.Schema.Type<typeof ListResponseSchema>

const EMPTY_IDS: ReadonlyArray<string> = []

const EMPTY_ENTRIES: DecodedList = []

function extractIds(payload: string): Effect.Effect<ReadonlyArray<string>, never> {
  return Effect.gen(function* () {
    const parsed = yield* Effect.sync(() => {
      try {
        return JSON.parse(payload)
      } catch {
        return EMPTY_IDS
      }
    })

    const entries = yield* Schema.decodeUnknownEffect(ListResponseSchema)(parsed).pipe(
      Effect.orElseSucceed(() => EMPTY_ENTRIES)
    )

    return entries.map((entry) => entry.id)
  })
}

function send(url: string, init: RequestInit): Effect.Effect<Response, CliRequestError> {
  return Effect.tryPromise({
    try: () => fetch(url, init),
    catch: () => new CliRequestError({ message: 'request failed' })
  })
}

function decodeJson<A, I>(
  response: Response,
  schema: Schema.Codec<A, I>
): Effect.Effect<A, CliRequestError> {
  return Effect.tryPromise({
    try: () => response.json(),
    catch: () => new CliRequestError({ message: 'cannot read response' })
  }).pipe(
    Effect.flatMap((payload) => Schema.decodeUnknownEffect(schema)(payload)),
    Effect.mapError(() => new CliRequestError({ message: 'unexpected response from server' }))
  )
}

function readHtmlFile(file: string): Effect.Effect<Buffer<ArrayBuffer>, CliUsageError> {
  return Effect.tryPromise({
    try: () => readFile(file),
    catch: () => new CliUsageError({ message: `cannot read file: ${file}` })
  }).pipe(
    Effect.filterOrFail(
      (body) => body.length <= MAX_HTML_BYTES,
      () => new CliUsageError({ message: `${file} is larger than the 95 MiB limit` })
    )
  )
}

function uploadFailure(status: number, action: string): string {
  if (status === 413) {
    return `${action} failed: file is larger than the 95 MiB limit`
  }

  return `${action} failed with status ${String(status)}`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function formatSessions(sessions: ReadonlyArray<Session>): string {
  if (sessions.length === 0) {
    return 'no paired browsers'
  }

  return sessions
    .map(
      (session) =>
        `${shortId(session.id)}  ${session.label}  paired ${session.createdAt.slice(0, 10)}`
    )
    .join('\n')
}

function fetchSessions(
  endpoint: string,
  token: string
): Effect.Effect<ReadonlyArray<Session>, CliRequestError> {
  return Effect.gen(function* () {
    const response = yield* send(apiUrl(endpoint, '/api/sessions'), {
      method: 'GET',
      headers: authHeaders(token)
    })

    if (response.status !== 200) {
      return yield* requestError(
        `listing paired browsers failed with status ${String(response.status)}`
      )
    }

    return yield* decodeJson(response, SessionsResponseSchema)
  })
}

function runPair(request: PairRequest): Effect.Effect<string, CliRequestError> {
  return Effect.gen(function* () {
    const response = yield* send(apiUrl(request.endpoint, '/api/pair'), {
      method: 'POST',
      headers: authHeaders(request.token)
    })

    if (response.status !== 201) {
      return yield* requestError(`pairing failed with status ${String(response.status)}`)
    }

    const pairing = yield* decodeJson(response, PairingResponseSchema)

    return [
      renderUnicodeCompact(pairing.url),
      '',
      'Open this link (or scan the code) on the device to pair, within 10 minutes:',
      pairing.url
    ].join('\n')
  })
}

function runDevices(request: DevicesRequest): Effect.Effect<string, CliRequestError> {
  return fetchSessions(request.endpoint, request.token).pipe(
    Effect.map((sessions) =>
      request.asJson ? JSON.stringify(sessions, null, 2) : formatSessions(sessions)
    )
  )
}

function runUnpair(request: UnpairRequest): Effect.Effect<string, CliRequestError> {
  return Effect.gen(function* () {
    const target = request.target

    if (target.kind === 'all') {
      const response = yield* send(apiUrl(request.endpoint, '/api/sessions'), {
        method: 'DELETE',
        headers: authHeaders(request.token)
      })

      if (response.status !== 200) {
        return yield* requestError(`unpair failed with status ${String(response.status)}`)
      }

      return 'unpaired every browser'
    }

    const sessions = yield* fetchSessions(request.endpoint, request.token)
    const matches = sessions.filter((session) => session.id.startsWith(target.prefix))
    const match = matches[0]

    if (match === undefined) {
      return yield* requestError(`no paired browser matches ${target.prefix}; see aha devices`)
    }

    if (matches.length > 1) {
      return yield* requestError(`${target.prefix} matches several browsers; use a longer id`)
    }

    const response = yield* send(apiUrl(request.endpoint, `/api/sessions/${match.id}`), {
      method: 'DELETE',
      headers: authHeaders(request.token)
    })

    if (response.status !== 200) {
      return yield* requestError(`unpair failed with status ${String(response.status)}`)
    }

    return `unpaired ${match.label} (${shortId(match.id)})`
  })
}

export function runCliRequest(
  request: Exclude<CliRequest, BuildRequest | ComponentsRequest>
): Effect.Effect<string, CliUsageError | CliRequestError> {
  if (request.command === 'pair') {
    return runPair(request)
  }

  if (request.command === 'devices') {
    return runDevices(request)
  }

  if (request.command === 'unpair') {
    return runUnpair(request)
  }

  if (request.command === 'upload') {
    return Effect.gen(function* () {
      const body = yield* readHtmlFile(request.file)

      const name = yield* deriveDocumentName(request.name, new TextDecoder().decode(body))
      const path = `/api/documents?name=${encodeURIComponent(name)}`

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(apiUrl(request.endpoint, path), {
            method: 'POST',
            headers: { ...authHeaders(request.token), 'content-type': 'text/html; charset=utf-8' },
            body
          }),
        catch: () => new CliRequestError({ message: 'request failed' })
      })

      if (response.status === 409) {
        return yield* requestError(`name "${name}" is already taken; pass a different --name NAME`)
      }

      if (response.status === 400) {
        return yield* requestError(`server rejected document name "${name}"; pass --name NAME`)
      }

      if (response.status !== 201) {
        return yield* requestError(uploadFailure(response.status, 'upload'))
      }

      return yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => new CliRequestError({ message: 'cannot read response' })
      })
    })
  }

  if (request.command === 'update') {
    return Effect.gen(function* () {
      const body = yield* readHtmlFile(request.file)

      const headers: HeaderMap = {
        ...authHeaders(request.token),
        'content-type': 'text/html; charset=utf-8'
      }

      if (request.ifMatch !== null) {
        headers['if-match'] = request.ifMatch
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(apiUrl(request.endpoint, `/api/documents/${request.id}`), {
            method: 'PUT',
            headers,
            body
          }),
        catch: () => new CliRequestError({ message: 'request failed' })
      })

      if (response.status !== 200) {
        return yield* requestError(uploadFailure(response.status, 'update'))
      }

      return yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => new CliRequestError({ message: 'cannot read response' })
      })
    })
  }

  if (request.command === 'publish') {
    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(apiUrl(request.endpoint, `/api/documents/${request.id}/publish`), {
            method: 'POST',
            headers: authHeaders(request.token)
          }),
        catch: () => new CliRequestError({ message: 'request failed' })
      })

      if (response.status !== 200) {
        return yield* requestError(`publish failed with status ${String(response.status)}`)
      }

      return `${request.publicUrl}/${request.id}`
    })
  }

  if (request.command === 'unpublish') {
    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(apiUrl(request.endpoint, `/api/documents/${request.id}/unpublish`), {
            method: 'POST',
            headers: authHeaders(request.token)
          }),
        catch: () => new CliRequestError({ message: 'request failed' })
      })

      if (response.status !== 200) {
        return yield* requestError(`unpublish failed with status ${String(response.status)}`)
      }

      return `unpublished ${request.id}`
    })
  }

  if (request.command === 'delete') {
    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(apiUrl(request.endpoint, `/api/documents/${request.id}`), {
            method: 'DELETE',
            headers: authHeaders(request.token)
          }),
        catch: () => new CliRequestError({ message: 'request failed' })
      })

      if (response.status !== 200) {
        return yield* requestError(`delete failed with status ${String(response.status)}`)
      }

      return `deleted ${request.id}`
    })
  }

  if (request.command === 'list') {
    return Effect.gen(function* () {
      const path = request.onlyPublic ? '/api/documents?public=1' : '/api/documents'

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(apiUrl(request.endpoint, path), {
            method: 'GET',
            headers: authHeaders(request.token)
          }),
        catch: () => new CliRequestError({ message: 'request failed' })
      })

      if (response.status !== 200) {
        return yield* requestError(`list failed with status ${String(response.status)}`)
      }

      const payload = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => new CliRequestError({ message: 'cannot read response' })
      })

      const ids = yield* extractIds(payload)

      if (request.asJson) {
        return formatListJson(ids)
      }

      return formatListText(ids)
    })
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(apiUrl(request.endpoint, `/api/documents/${request.id}`), {
          method: 'GET',
          headers: authHeaders(request.token)
        }),
      catch: () => new CliRequestError({ message: 'request failed' })
    })

    if (response.status !== 200) {
      return yield* requestError(`read failed with status ${String(response.status)}`)
    }

    const buffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: () => new CliRequestError({ message: 'cannot read response' })
    })

    const bytes = new Uint8Array(buffer)

    if (request.output !== null) {
      const output = request.output

      yield* Effect.tryPromise({
        try: () => writeFile(output, bytes),
        catch: () => new CliUsageError({ message: `cannot write file: ${output}` })
      })

      return output
    }

    return new TextDecoder().decode(bytes)
  })
}
