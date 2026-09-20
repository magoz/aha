import { Effect, Schema } from 'effect'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'

import { DEFAULT_PUBLIC_URL } from '../lib/config.js'
import type { EnvMap } from '../lib/headers.js'
import { isPlanId } from '../lib/plan-id.js'

export const DEFAULT_ENDPOINT = 'https://aha.oox.sh'

export class CliUsageError extends Schema.TaggedError<CliUsageError>()('CliUsageError', {
  message: Schema.String
}) {}

export interface UploadRequest {
  readonly command: 'upload'
  readonly file: string
  readonly endpoint: string
  readonly publicUrl: string
  readonly token: string
}

export interface UpdateRequest {
  readonly command: 'update'
  readonly id: string
  readonly file: string
  readonly ifMatch: string | null
  readonly endpoint: string
  readonly token: string
}

export interface PublishRequest {
  readonly command: 'publish'
  readonly id: string
  readonly endpoint: string
  readonly publicUrl: string
  readonly token: string
}

export interface UnpublishRequest {
  readonly command: 'unpublish'
  readonly id: string
  readonly endpoint: string
  readonly token: string
}

export interface DeleteRequest {
  readonly command: 'delete'
  readonly id: string
  readonly endpoint: string
  readonly token: string
}

export type SimpleRequest = PublishRequest | UnpublishRequest | DeleteRequest

export interface ListRequest {
  readonly command: 'list'
  readonly onlyPublic: boolean
  readonly asJson: boolean
  readonly endpoint: string
  readonly token: string
}

export interface ReadRequest {
  readonly command: 'read'
  readonly id: string
  readonly output: string | null
  readonly endpoint: string
  readonly token: string
}

export type CliRequest = UploadRequest | UpdateRequest | SimpleRequest | ListRequest | ReadRequest

interface GlobalOptions {
  readonly endpoint: string
  readonly publicUrl: string
  readonly token: string | null
}

function fail(message: string): Effect.Effect<never, CliUsageError> {
  return Effect.fail(new CliUsageError({ message }))
}

function readToken(args: ReadonlyArray<string>, env: EnvMap): string | null {
  const flagIndex = args.indexOf('--token')

  if (flagIndex !== -1) {
    const raw = args[flagIndex + 1]

    if (raw !== undefined && raw.length > 0) {
      return raw
    }
  }

  const fromEnv = env['AHA_OWNER_TOKEN']

  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv
  }

  return null
}

function readEndpoint(args: ReadonlyArray<string>, env: EnvMap): string {
  const flagIndex = args.indexOf('--endpoint')

  if (flagIndex !== -1) {
    const raw = args[flagIndex + 1]

    if (raw !== undefined && raw.length > 0) {
      return raw
    }
  }

  const fromEnv = env['AHA_ENDPOINT']

  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv
  }

  return DEFAULT_ENDPOINT
}

function readPublicUrl(args: ReadonlyArray<string>, env: EnvMap): string {
  const flagIndex = args.indexOf('--public-url')

  if (flagIndex !== -1) {
    const raw = args[flagIndex + 1]

    if (raw !== undefined && raw.length > 0) {
      return raw
    }
  }

  const fromEnv = env['AHA_PUBLIC_URL']

  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv
  }

  return DEFAULT_PUBLIC_URL
}

function stripGlobalFlags(args: ReadonlyArray<string>): Array<string> {
  const out: Array<string> = []
  let index = 0

  while (index < args.length) {
    const current = args[index]

    if (current === undefined) {
      break
    }

    if (current === '--token' || current === '--endpoint' || current === '--public-url') {
      index += 2
      continue
    }

    out.push(current)
    index += 1
  }

  return out
}

export function validateEndpoint(endpoint: string): Effect.Effect<string, CliUsageError> {
  return Effect.suspend(() => {
    let parsed: URL

    try {
      parsed = new URL(endpoint)
    } catch {
      return fail(`invalid endpoint: ${endpoint}`)
    }

    if (parsed.protocol === 'https:') {
      return Effect.succeed(parsed.toString().replace(/\/$/, ''))
    }

    if (parsed.protocol === 'http:') {
      const host = parsed.hostname

      if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
        return Effect.succeed(parsed.toString().replace(/\/$/, ''))
      }

      return fail('plain http endpoints are only allowed for loopback development')
    }

    return fail('endpoint must be https (loopback http is allowed for development)')
  })
}

function checkCredentialsFilePerms(mode: number): boolean {
  return (mode & 0o077) === 0
}

export function resolveTokenFromFile(path: string): Effect.Effect<string, CliUsageError> {
  return Effect.gen(function* () {
    const info = yield* Effect.tryPromise({
      try: () => stat(path),
      catch: () => new CliUsageError({ message: `cannot read credentials file: ${path}` })
    })

    if (!checkCredentialsFilePerms(info.mode)) {
      return yield* new CliUsageError({
        message: `credentials file ${path} must have mode 0600 (owner read/write only)`
      })
    }

    const content = yield* Effect.tryPromise({
      try: () => readFile(path, 'utf8'),
      catch: () => new CliUsageError({ message: `cannot read credentials file: ${path}` })
    })

    for (const line of content.split('\n')) {
      const trimmed = line.trim()

      if (trimmed.startsWith('AHA_OWNER_TOKEN=')) {
        const token = trimmed.slice('AHA_OWNER_TOKEN='.length).trim()

        if (token.length > 0) {
          return token
        }
      }
    }

    return yield* new CliUsageError({
      message: `no AHA_OWNER_TOKEN entry in credentials file: ${path}`
    })
  })
}

function defaultCredentialsPath(): string | null {
  const home = homedir()

  if (home.length === 0) {
    return null
  }

  return `${home}/.config/aha/credentials`
}

function resolveOwnerToken(flag: string | null, env: EnvMap): Effect.Effect<string, CliUsageError> {
  if (flag !== null) {
    return Effect.succeed(flag)
  }

  const configured = env['AHA_CREDENTIALS_FILE']

  if (configured !== undefined && configured.length > 0) {
    return resolveTokenFromFile(configured)
  }

  const fallback = defaultCredentialsPath()

  if (fallback === null) {
    return fail('missing owner token: pass --token or set AHA_OWNER_TOKEN')
  }

  return Effect.flatMap(
    Effect.promise(() =>
      stat(fallback).then(
        () => true,
        () => false
      )
    ),
    (exists) => {
      if (!exists) {
        return fail('missing owner token: pass --token or set AHA_OWNER_TOKEN')
      }

      return resolveTokenFromFile(fallback)
    }
  )
}

export function parseCliArgs(
  rawArgs: ReadonlyArray<string>,
  env: EnvMap
): Effect.Effect<CliRequest, CliUsageError> {
  return Effect.suspend((): Effect.Effect<CliRequest, CliUsageError> => {
    const globals: GlobalOptions = {
      endpoint: readEndpoint(rawArgs, env),
      publicUrl: readPublicUrl(rawArgs, env),
      token: readToken(rawArgs, env)
    }

    const args = stripGlobalFlags(rawArgs)
    const command = args[0]

    if (command === undefined) {
      return fail('usage: aha <upload|update|publish|unpublish|list|read|delete> ...')
    }

    if (command === 'upload') {
      const file = args[1]

      if (file === undefined) {
        return fail('usage: aha upload FILE [--endpoint URL] [--token TOKEN]')
      }

      return Effect.flatMap(
        Effect.all({
          endpoint: validateEndpoint(globals.endpoint),
          publicUrl: validateEndpoint(globals.publicUrl),
          token: resolveOwnerToken(globals.token, env)
        }),
        ({ endpoint, publicUrl, token }) =>
          Effect.succeed({ command: 'upload' as const, file, endpoint, publicUrl, token })
      )
    }

    if (command === 'update') {
      const id = args[1]
      const file = args[2]

      if (id === undefined || file === undefined) {
        return fail('usage: aha update ID FILE [--if-match ETAG] [--endpoint URL] [--token TOKEN]')
      }

      if (!isPlanId(id)) {
        return fail(`invalid id: ${id}`)
      }

      const matchIndex = args.indexOf('--if-match')
      const matchRaw = matchIndex === -1 ? undefined : args[matchIndex + 1]
      const ifMatch = matchRaw === undefined || matchRaw.length === 0 ? null : matchRaw

      return Effect.flatMap(
        Effect.all({
          endpoint: validateEndpoint(globals.endpoint),
          token: resolveOwnerToken(globals.token, env)
        }),
        ({ endpoint, token }) =>
          Effect.succeed({ command: 'update' as const, id, file, ifMatch, endpoint, token })
      )
    }

    if (command === 'publish' || command === 'unpublish' || command === 'delete') {
      const id = args[1]

      if (id === undefined) {
        return fail(`usage: aha ${command} ID [--endpoint URL] [--token TOKEN]`)
      }

      if (!isPlanId(id)) {
        return fail(`invalid id: ${id}`)
      }

      if (command === 'publish') {
        return Effect.flatMap(
          Effect.all({
            endpoint: validateEndpoint(globals.endpoint),
            publicUrl: validateEndpoint(globals.publicUrl),
            token: resolveOwnerToken(globals.token, env)
          }),
          ({ endpoint, publicUrl, token }) =>
            Effect.succeed({ command: 'publish' as const, id, endpoint, publicUrl, token })
        )
      }

      if (command === 'unpublish') {
        return Effect.flatMap(
          Effect.all({
            endpoint: validateEndpoint(globals.endpoint),
            token: resolveOwnerToken(globals.token, env)
          }),
          ({ endpoint, token }) =>
            Effect.succeed({ command: 'unpublish' as const, id, endpoint, token })
        )
      }

      return Effect.flatMap(
        Effect.all({
          endpoint: validateEndpoint(globals.endpoint),
          token: resolveOwnerToken(globals.token, env)
        }),
        ({ endpoint, token }) => Effect.succeed({ command: 'delete' as const, id, endpoint, token })
      )
    }

    if (command === 'list') {
      const onlyPublic = args.includes('--public')
      const asJson = args.includes('--json')

      return Effect.flatMap(
        Effect.all({
          endpoint: validateEndpoint(globals.endpoint),
          token: resolveOwnerToken(globals.token, env)
        }),
        ({ endpoint, token }) =>
          Effect.succeed({ command: 'list' as const, onlyPublic, asJson, endpoint, token })
      )
    }

    if (command === 'read') {
      const id = args[1]

      if (id === undefined) {
        return fail('usage: aha read ID [--output FILE] [--endpoint URL] [--token TOKEN]')
      }

      if (!isPlanId(id)) {
        return fail(`invalid id: ${id}`)
      }

      const outputIndex = args.indexOf('--output')
      const outputRaw = outputIndex === -1 ? undefined : args[outputIndex + 1]
      const output = outputRaw === undefined || outputRaw.length === 0 ? null : outputRaw

      return Effect.flatMap(
        Effect.all({
          endpoint: validateEndpoint(globals.endpoint),
          token: resolveOwnerToken(globals.token, env)
        }),
        ({ endpoint, token }) =>
          Effect.succeed({ command: 'read' as const, id, output, endpoint, token })
      )
    }

    return fail(`unknown command: ${command}`)
  })
}
