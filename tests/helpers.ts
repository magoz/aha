import { Layer } from 'effect'

import type { ServiceConfig } from '../lib/config.js'
import { PlansStorageTag } from '../lib/storage.js'
import { createFakeState, createFakeStorage } from './fake-storage.js'
import type { FakeStorageState } from './fake-storage.js'

export const TEST_OWNER_TOKEN = 'test-owner-token-0123456789abcdef'

export const TEST_PRIVATE_TOKEN = 'test-private-token-0123456789abcdef'

export const TEST_CONFIG: ServiceConfig = {
  ownerToken: TEST_OWNER_TOKEN,
  privateReadToken: TEST_PRIVATE_TOKEN,
  bucket: 'test-bucket',
  endpoint: 'https://test-account.r2.cloudflarestorage.com',
  region: 'auto',
  accessKeyId: 'test-key-id',
  secretAccessKey: 'test-secret',
  publicUrl: 'https://plans.oox.sh'
}

export function ownerAuth(): string {
  return `Bearer ${TEST_OWNER_TOKEN}`
}

export function privateAuth(): string {
  return `Bearer ${TEST_PRIVATE_TOKEN}`
}

export function htmlBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function bytesToString(body: Uint8Array): string {
  return new TextDecoder().decode(body)
}

export interface TestContext {
  readonly state: FakeStorageState
  readonly layer: Layer.Layer<PlansStorageTag>
}

export function makeTestContext(): TestContext {
  const state = createFakeState()
  const layer = Layer.succeed(PlansStorageTag)(createFakeStorage(state))

  return { state, layer }
}
