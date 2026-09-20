import { Context, Effect, Layer } from 'effect'

import { InvalidConfig } from './errors.js'
import type { EnvMap } from './headers.js'

export const DEFAULT_PUBLIC_URL = 'https://aha.oox.sh'

export interface ServiceConfig {
  readonly ownerToken: string
  readonly privateReadToken: string
  readonly bucket: string
  readonly endpoint: string
  readonly region: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly publicUrl: string
}

export class ServiceConfigTag extends Context.Service<ServiceConfigTag, ServiceConfig>()(
  'ServiceConfig'
) {}

function requiredEnv(name: string, env: EnvMap): string | null {
  const value = env[name]

  if (value === undefined || value.trim().length === 0) {
    return null
  }

  return value
}

function normalizeBaseUrl(raw: string): string | null {
  let parsed: URL

  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null
  }

  return parsed.toString().replace(/\/$/, '')
}

export function readConfig(env: EnvMap): Effect.Effect<ServiceConfig, InvalidConfig> {
  return Effect.suspend(() => {
    const ownerToken = requiredEnv('AHA_OWNER_TOKEN', env)
    const privateReadToken = requiredEnv('AHA_PRIVATE_READ_TOKEN', env)
    const bucket = requiredEnv('R2_BUCKET', env)
    const endpoint = requiredEnv('R2_ENDPOINT', env)
    const accessKeyId = requiredEnv('R2_ACCESS_KEY_ID', env)
    const secretAccessKey = requiredEnv('R2_SECRET_ACCESS_KEY', env)
    const region = requiredEnv('R2_REGION', env) ?? 'auto'
    const publicUrl = normalizeBaseUrl(requiredEnv('AHA_PUBLIC_URL', env) ?? DEFAULT_PUBLIC_URL)

    if (ownerToken === null) {
      return Effect.fail(new InvalidConfig({ detail: 'missing AHA_OWNER_TOKEN' }))
    }

    if (privateReadToken === null) {
      return Effect.fail(new InvalidConfig({ detail: 'missing AHA_PRIVATE_READ_TOKEN' }))
    }

    if (ownerToken === privateReadToken) {
      return Effect.fail(new InvalidConfig({ detail: 'owner and private-read tokens must differ' }))
    }

    if (bucket === null) {
      return Effect.fail(new InvalidConfig({ detail: 'missing R2_BUCKET' }))
    }

    if (endpoint === null) {
      return Effect.fail(new InvalidConfig({ detail: 'missing R2_ENDPOINT' }))
    }

    if (accessKeyId === null) {
      return Effect.fail(new InvalidConfig({ detail: 'missing R2_ACCESS_KEY_ID' }))
    }

    if (secretAccessKey === null) {
      return Effect.fail(new InvalidConfig({ detail: 'missing R2_SECRET_ACCESS_KEY' }))
    }

    if (publicUrl === null) {
      return Effect.fail(new InvalidConfig({ detail: 'invalid AHA_PUBLIC_URL' }))
    }

    return Effect.succeed({
      ownerToken,
      privateReadToken,
      bucket,
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      publicUrl
    })
  })
}

export function configLayer(env: EnvMap): Layer.Layer<ServiceConfigTag, InvalidConfig> {
  return Layer.effect(ServiceConfigTag, readConfig(env))
}
