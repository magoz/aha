import { timingSafeEqual } from 'node:crypto'

export type CallerRole = 'owner' | 'private-read' | 'anonymous'

export interface Caller {
  readonly role: CallerRole
}

function credentialsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')

  if (a.length !== b.length) {
    return false
  }

  return timingSafeEqual(a, b)
}

export function bearerToken(authorization: string | null): string | null {
  if (authorization === null) {
    return null
  }

  const prefix = 'Bearer '

  if (!authorization.startsWith(prefix)) {
    return null
  }

  const token = authorization.slice(prefix.length).trim()

  if (token.length === 0) {
    return null
  }

  return token
}

export function identifyCaller(
  authorization: string | null,
  ownerToken: string,
  privateReadToken: string
): Caller {
  const token = bearerToken(authorization)

  if (token === null) {
    return { role: 'anonymous' }
  }

  if (credentialsEqual(token, ownerToken)) {
    return { role: 'owner' }
  }

  if (credentialsEqual(token, privateReadToken)) {
    return { role: 'private-read' }
  }

  return { role: 'anonymous' }
}

export function isOwner(caller: Caller): boolean {
  return caller.role === 'owner'
}

export function canReadContent(caller: Caller): boolean {
  return caller.role === 'owner' || caller.role === 'private-read'
}
