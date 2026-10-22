import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { Effect, Predicate, Schema } from 'effect'

import { runCliRequest } from '../cli/client.js'
import type { UploadRequest } from '../cli/parser.js'
import { MAX_HTML_BYTES } from '../lib/html-limits.js'
import { SESSION_COOKIE } from '../lib/sessions.js'
import { createFakeR2Bucket } from './fake-r2-bucket.js'
import type { FakeR2Bucket } from './fake-r2-bucket.js'
import { TEST_OWNER_TOKEN, bytesToString } from './helpers.js'
import { createWorkerServer } from './worker-server.js'

const ORIGINAL =
  '<!doctype html><html><head><title>R&amp;D Plan</title></head><body>v1</body></html>'

const INTRUDER =
  '<!doctype html><html><head><title>R&amp;D Plan</title></head><body>v2</body></html>'

const AddressSchema = Schema.Struct({ port: Schema.Number })

const CreatedPayload = Schema.Struct({ id: Schema.String, url: Schema.String })

const SessionsPayload = Schema.Array(Schema.Struct({ id: Schema.String, label: Schema.String }))

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

function endpointFor(port: number): string {
  return `http://127.0.0.1:${String(port)}`
}

function uploadRequest(port: number, file: string, name: string | null): UploadRequest {
  return {
    command: 'upload',
    file,
    name,
    endpoint: endpointFor(port),
    publicUrl: 'https://aha.o-o.co',
    token: TEST_OWNER_TOKEN
  }
}

function withWorker<A>(
  run: (bucket: FakeR2Bucket, port: number, dir: string) => Effect.Effect<A, Error>
): Effect.Effect<A, Error> {
  return Effect.gen(function* () {
    const bucket = createFakeR2Bucket()

    const server = createWorkerServer({
      AHA_BUCKET: bucket,
      AHA_OWNER_TOKEN: TEST_OWNER_TOKEN,
      AHA_PUBLIC_URL: 'https://aha.o-o.co'
    })

    const dir = yield* Effect.tryPromise({
      try: () => mkdtemp(join(tmpdir(), 'aha-cli-')),
      catch: () => new Error('mkdtemp failed')
    })

    return yield* Effect.acquireUseRelease(
      listen(server),
      (port) => run(bucket, port, dir),
      () => close(server)
    ).pipe(Effect.ensuring(Effect.promise(() => rm(dir, { recursive: true }))))
  })
}

function storedText(bucket: FakeR2Bucket, id: string): string {
  const object = bucket.objects.get(`aha/${id}.html`)

  return object === undefined ? '' : bytesToString(object.body)
}

describe('cli against the worker', () => {
  it.effect(
    'derives the name from the title, reports taken names and honors --name',
    () =>
      withWorker((bucket, port, dir) =>
        Effect.gen(function* () {
          const first = join(dir, 'first.html')
          const second = join(dir, 'second.html')

          yield* Effect.tryPromise({
            try: () => Promise.all([writeFile(first, ORIGINAL), writeFile(second, INTRUDER)]),
            catch: () => new Error('write failed')
          })

          const output = yield* runCliRequest(uploadRequest(port, first, null)).pipe(
            Effect.mapError(() => new Error('first upload failed'))
          )

          const created = yield* Schema.decodeUnknownEffect(CreatedPayload)(
            JSON.parse(output)
          ).pipe(Effect.mapError(() => new Error('bad upload output')))

          expect(created.id).toBe('randd-plan')
          expect(created.url).toBe('https://aha.o-o.co/randd-plan')

          const clash = yield* Effect.flip(runCliRequest(uploadRequest(port, second, null))).pipe(
            Effect.mapError(() => new Error('second upload unexpectedly succeeded'))
          )

          expect(Predicate.isTagged(clash, 'CliRequestError')).toBe(true)
          expect(clash.message.includes('already taken')).toBe(true)
          expect(storedText(bucket, 'randd-plan')).toBe(ORIGINAL)

          const renamed = yield* runCliRequest(uploadRequest(port, second, 'R&D Plan v2')).pipe(
            Effect.mapError(() => new Error('renamed upload failed'))
          )

          expect(renamed.includes('"id":"randd-plan-v2"')).toBe(true)
          expect(storedText(bucket, 'randd-plan-v2')).toBe(INTRUDER)
        })
      ),
    15000
  )

  it.effect('refuses files over the limit before sending them', () =>
    withWorker((bucket, port, dir) =>
      Effect.gen(function* () {
        const big = join(dir, 'big.html')

        yield* Effect.tryPromise({
          try: () => writeFile(big, '').then(() => truncate(big, MAX_HTML_BYTES + 1)),
          catch: () => new Error('write failed')
        })

        const failure = yield* Effect.flip(runCliRequest(uploadRequest(port, big, 'big'))).pipe(
          Effect.mapError(() => new Error('oversized upload unexpectedly succeeded'))
        )

        expect(Predicate.isTagged(failure, 'CliUsageError')).toBe(true)
        expect(failure.message.includes('95 MiB')).toBe(true)
        expect(bucket.objects.size).toBe(0)
      })
    )
  )

  it.effect('pairs, lists and unpairs browsers', () =>
    withWorker((_bucket, port) =>
      Effect.gen(function* () {
        const base = { endpoint: endpointFor(port), token: TEST_OWNER_TOKEN }
        const fail = () => new Error('cli request failed')

        const pairOutput = yield* runCliRequest({ command: 'pair', ...base }).pipe(
          Effect.mapError(fail)
        )

        const link = pairOutput.split('\n').at(-1) ?? ''

        expect(link.startsWith('https://aha.o-o.co/pair/')).toBe(true)

        const paired = yield* Effect.tryPromise({
          try: () =>
            fetch(`${endpointFor(port)}${new URL(link).pathname}`, {
              method: 'POST',
              redirect: 'manual',
              headers: { 'user-agent': 'Mozilla/5.0 (iPhone) Version/18 Mobile Safari/605' }
            }),
          catch: fail
        })

        expect(paired.status).toBe(303)
        expect(paired.headers.get('set-cookie')?.startsWith(`${SESSION_COOKIE}=`)).toBe(true)

        const devices = yield* runCliRequest({ command: 'devices', asJson: true, ...base }).pipe(
          Effect.mapError(fail)
        )

        const sessions = yield* Schema.decodeUnknownEffect(SessionsPayload)(
          JSON.parse(devices)
        ).pipe(Effect.mapError(fail))

        expect(sessions.map((session) => session.label)).toEqual(['Safari on iPhone'])

        const prefix = sessions[0]?.id.slice(0, 6) ?? ''

        const unpaired = yield* runCliRequest({
          command: 'unpair',
          target: { kind: 'id', prefix },
          ...base
        }).pipe(Effect.mapError(fail))

        expect(unpaired.startsWith('unpaired Safari on iPhone')).toBe(true)

        const empty = yield* runCliRequest({ command: 'devices', asJson: false, ...base }).pipe(
          Effect.mapError(fail)
        )

        expect(empty).toBe('no paired browsers')
      })
    )
  )
})
