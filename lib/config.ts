import { Effect } from 'effect'

import { InvalidConfig } from './errors.js'
import type { EnvMap } from './headers.js'

export const DEFAULT_PUBLIC_URL = 'https://aha.o-o.co'

export interface ServiceConfig {
  readonly ownerToken: string
  readonly publicUrl: string
}

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
    const publicUrl = normalizeBaseUrl(requiredEnv('AHA_PUBLIC_URL', env) ?? DEFAULT_PUBLIC_URL)

    if (ownerToken === null) {
      return Effect.fail(new InvalidConfig({ detail: 'missing AHA_OWNER_TOKEN' }))
    }

    if (publicUrl === null) {
      return Effect.fail(new InvalidConfig({ detail: 'invalid AHA_PUBLIC_URL' }))
    }

    return Effect.succeed({ ownerToken, publicUrl })
  })
}
