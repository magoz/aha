import type { HeaderMap } from './headers.js'

export const SECURITY_HEADERS: HeaderMap = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; sandbox",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'cross-origin-resource-policy': 'same-origin'
}

export function withSecurityHeaders(headers: HeaderMap): HeaderMap {
  const merged: HeaderMap = { ...SECURITY_HEADERS }

  for (const key of Object.keys(headers)) {
    const value = headers[key]

    if (value === undefined) {
      continue
    }

    merged[key.toLowerCase()] = value
  }

  return merged
}
