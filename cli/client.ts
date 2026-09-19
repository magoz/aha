import { Effect, Schema } from 'effect'
import { readFile, writeFile } from 'node:fs/promises'

import type { HeaderMap } from '../lib/headers.js'
import { PlanIdSchema } from '../lib/plan-id.js'

const ListItemSchema = Schema.Struct({
  id: PlanIdSchema,
  isPublic: Schema.Boolean,
  etag: Schema.String
})

const ListResponseSchema = Schema.Array(ListItemSchema)

import type { CliRequest } from './parser.js'
import { CliUsageError } from './parser.js'

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

export function runCliRequest(
  request: CliRequest
): Effect.Effect<string, CliUsageError | CliRequestError> {
  if (request.command === 'upload') {
    return Effect.gen(function* () {
      const body = yield* Effect.tryPromise({
        try: () => readFile(request.file),
        catch: () => new CliUsageError({ message: `cannot read file: ${request.file}` })
      })

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(apiUrl(request.endpoint, '/api/documents'), {
            method: 'POST',
            headers: { ...authHeaders(request.token), 'content-type': 'text/html; charset=utf-8' },
            body
          }),
        catch: () => new CliRequestError({ message: 'request failed' })
      })

      if (response.status !== 201) {
        return yield* requestError(`upload failed with status ${String(response.status)}`)
      }

      return yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => new CliRequestError({ message: 'cannot read response' })
      })
    })
  }

  if (request.command === 'update') {
    return Effect.gen(function* () {
      const body = yield* Effect.tryPromise({
        try: () => readFile(request.file),
        catch: () => new CliUsageError({ message: `cannot read file: ${request.file}` })
      })

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
        return yield* requestError(`update failed with status ${String(response.status)}`)
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
