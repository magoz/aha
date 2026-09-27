import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate, Schema } from 'effect'

import { runCliRequest } from '../cli/client.js'
import type { UploadRequest } from '../cli/parser.js'
import { handleAhaRequest } from '../lib/http.js'
import { createAhaServer } from '../server/node-adapter.js'
import { TEST_CONFIG, TEST_OWNER_TOKEN, bytesToString, makeTestContext } from './helpers.js'
import type { TestContext } from './helpers.js'

const ORIGINAL =
  '<!doctype html><html><head><title>R&amp;D Plan</title></head><body>v1</body></html>'

const INTRUDER =
  '<!doctype html><html><head><title>R&amp;D Plan</title></head><body>v2</body></html>'

const AddressSchema = Schema.Struct({ port: Schema.Number })

const CreatedPayload = Schema.Struct({ id: Schema.String, url: Schema.String })

function listen(server: Server): Effect.Effect<number, Error> {
  return Effect.tryPromise({
    try: () =>
      new Promise<number>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
          Effect.runPromise(
            Schema.decodeUnknownEffect(AddressSchema)(server.address()).pipe(
              Effect.map((decoded) => decoded.port),
              Effect.orElseSucceed(() => -1)
            )
          ).then((found) => {
            if (found < 0) {
              reject(new Error('no address'))
            } else {
              resolve(found)
            }
          }, reject)
        })
      }),
    catch: () => new Error('listen failed')
  })
}

function close(server: Server): Effect.Effect<void> {
  return Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      })
  )
}

function uploadRequest(port: number, file: string, name: string | null): UploadRequest {
  return {
    command: 'upload',
    file,
    name,
    endpoint: `http://127.0.0.1:${String(port)}`,
    publicUrl: 'https://aha.oox.sh',
    token: TEST_OWNER_TOKEN
  }
}

function runUploads(ctx: TestContext, port: number, dir: string): Effect.Effect<void, Error> {
  return Effect.gen(function* () {
    const first = join(dir, 'first.html')
    const second = join(dir, 'second.html')

    yield* Effect.tryPromise({
      try: () => Promise.all([writeFile(first, ORIGINAL), writeFile(second, INTRUDER)]),
      catch: () => new Error('write failed')
    })

    const output = yield* runCliRequest(uploadRequest(port, first, null)).pipe(
      Effect.mapError(() => new Error('first upload failed'))
    )

    const created = yield* Schema.decodeUnknownEffect(CreatedPayload)(JSON.parse(output)).pipe(
      Effect.mapError(() => new Error('bad upload output'))
    )

    expect(created.id).toBe('randd-plan')
    expect(created.url).toBe('https://aha.oox.sh/randd-plan')

    const clash = yield* Effect.flip(runCliRequest(uploadRequest(port, second, null))).pipe(
      Effect.mapError(() => new Error('second upload unexpectedly succeeded'))
    )

    expect(Predicate.isTagged(clash, 'CliRequestError')).toBe(true)
    expect(clash.message.includes('already taken')).toBe(true)
    expect(clash.message.includes('--name')).toBe(true)

    const stored = ctx.state.documents.get('randd-plan')

    expect(stored === undefined ? '' : bytesToString(stored.body)).toBe(ORIGINAL)

    const renamed = yield* runCliRequest(uploadRequest(port, second, 'R&D Plan v2')).pipe(
      Effect.mapError(() => new Error('renamed upload failed'))
    )

    expect(renamed.includes('"id":"randd-plan-v2"')).toBe(true)
  })
}

describe('cli upload', () => {
  it.effect(
    'derives the name from the title, reports taken names and honors --name',
    () =>
      Effect.gen(function* () {
        const ctx = makeTestContext()

        const server = createAhaServer((request) =>
          handleAhaRequest(request, TEST_CONFIG).pipe(Effect.provide(ctx.layer))
        )

        const dir = yield* Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), 'aha-cli-upload-')),
          catch: () => new Error('mkdtemp failed')
        })

        yield* Effect.acquireUseRelease(
          listen(server),
          (port) => runUploads(ctx, port, dir),
          () => close(server)
        ).pipe(Effect.ensuring(Effect.promise(() => rm(dir, { recursive: true }))))
      }),
    15000
  )
})
