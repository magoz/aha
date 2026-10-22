const textEncoder = new TextEncoder()

// Compares every byte so the time taken does not reveal how much of a guess was right. Runs the same
// in Node and Workers (no `node:crypto`).
export function constantTimeEqual(provided: string, expected: string): boolean {
  const a = textEncoder.encode(provided)
  const b = textEncoder.encode(expected)

  if (a.length !== b.length) {
    return false
  }

  let difference = 0

  for (let index = 0; index < a.length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0)
  }

  return difference === 0
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

// The owner bearer is the only credential for writes, listing, publishing and pairing. Browsers
// never send it on their own, so cookie-bearing cross-site requests cannot reach those actions.
export function isOwnerAuthorization(authorization: string | null, ownerToken: string): boolean {
  const token = bearerToken(authorization)

  return token !== null && constantTimeEqual(token, ownerToken)
}
