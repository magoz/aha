import { Effect, Layer } from 'effect'

import type { ServiceConfig } from '../lib/config.js'
import type { AhaResponse } from '../lib/http.js'
import { SessionStoreTag } from '../lib/sessions.js'
import { AhaStorageTag } from '../lib/storage.js'
import type { DocumentUpload } from '../lib/storage.js'
import {
  collect,
  createFakeSessionStore,
  createFakeState,
  createFakeStorage,
  streamOf
} from './fake-storage.js'
import type { FakeStorageState } from './fake-storage.js'

export const TEST_OWNER_TOKEN = 'test-owner-token-0123456789abcdef'

export const TEST_CONFIG: ServiceConfig = {
  ownerToken: TEST_OWNER_TOKEN,
  publicUrl: 'https://aha.o-o.co'
}

export function ownerAuth(): string {
  return `Bearer ${TEST_OWNER_TOKEN}`
}

export function htmlBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function bytesToString(body: Uint8Array): string {
  return new TextDecoder().decode(body)
}

export function uploadOf(value: string): DocumentUpload {
  const bytes = htmlBytes(value)

  return { body: streamOf(bytes), contentLength: bytes.length }
}

export function responseText(response: AhaResponse): Effect.Effect<string> {
  const body = response.body

  if (body === null) {
    return Effect.succeed('')
  }

  if (body instanceof Uint8Array) {
    return Effect.succeed(bytesToString(body))
  }

  return Effect.promise(() => collect(body)).pipe(Effect.map(bytesToString))
}

export function storedText(state: FakeStorageState, id: string): string {
  const entry = state.documents.get(id)

  return entry === undefined ? '' : bytesToString(entry.body)
}

export interface TestContext {
  readonly state: FakeStorageState
  readonly layer: Layer.Layer<AhaStorageTag | SessionStoreTag>
}

export function makeTestContext(): TestContext {
  const state = createFakeState()

  const layer = Layer.mergeAll(
    Layer.succeed(AhaStorageTag)(createFakeStorage(state)),
    Layer.succeed(SessionStoreTag)(createFakeSessionStore(state))
  )

  return { state, layer }
}
