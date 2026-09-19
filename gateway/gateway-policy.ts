import { isPlanId } from '../lib/plan-id.js'

const ALLOWED_METHODS = new Set(['GET', 'HEAD'])

function hasSuspiciousEncoding(pathname: string): boolean {
  return pathname.includes('%') || pathname.includes('\\')
}

export function gatewayDocumentId(pathname: string): string | null {
  if (hasSuspiciousEncoding(pathname)) {
    return null
  }

  if (pathname.includes('//')) {
    return null
  }

  const normalized =
    pathname.endsWith('/') && pathname.length > 1
      ? pathname.slice(0, pathname.length - 1)
      : pathname

  if (!normalized.startsWith('/')) {
    return null
  }

  const id = normalized.slice(1)

  if (!isPlanId(id)) {
    return null
  }

  return id
}

export function isAllowedGatewayRequest(method: string, pathname: string): boolean {
  if (!ALLOWED_METHODS.has(method.toUpperCase())) {
    return false
  }

  return gatewayDocumentId(pathname) !== null
}
