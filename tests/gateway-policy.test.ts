import { describe, expect, it } from 'vitest'

import { gatewayDocumentId, isAllowedGatewayRequest } from '../gateway/gateway-policy.js'

const VALID = 'AAAAAAAAAAAAAAAAAAAAAA'

const VALID_TWO = 'BBBBBBBBBBBBBBBBBBBBBB'

describe('gateway policy', () => {
  it('permits only GET and HEAD document paths', () => {
    expect(isAllowedGatewayRequest('GET', `/${VALID}`)).toBe(true)
    expect(isAllowedGatewayRequest('HEAD', `/${VALID}`)).toBe(true)
    expect(isAllowedGatewayRequest('get', `/${VALID}`)).toBe(true)
    expect(isAllowedGatewayRequest('POST', `/${VALID}`)).toBe(false)
    expect(isAllowedGatewayRequest('PUT', `/${VALID}`)).toBe(false)
    expect(isAllowedGatewayRequest('DELETE', `/${VALID}`)).toBe(false)
    expect(isAllowedGatewayRequest('GET', `/${VALID_TWO}/`)).toBe(true)
  })

  it('rejects api, mutation and proxy-style paths', () => {
    expect(isAllowedGatewayRequest('GET', '/api/documents')).toBe(false)
    expect(isAllowedGatewayRequest('GET', `/api/documents/${VALID}`)).toBe(false)
    expect(isAllowedGatewayRequest('GET', `/api/documents/${VALID}/publish`)).toBe(false)
    expect(isAllowedGatewayRequest('GET', '/')).toBe(false)
    expect(isAllowedGatewayRequest('GET', '/api/health')).toBe(false)
    expect(isAllowedGatewayRequest('GET', `/${VALID}/publish`)).toBe(false)
    expect(isAllowedGatewayRequest('GET', `https://plans.oox.sh/${VALID}`)).toBe(false)
  })

  it('rejects encodings, traversal and malformed ids', () => {
    expect(isAllowedGatewayRequest('GET', '/%41AAAAAAAAAAAAAAAAAAAAA')).toBe(false)
    expect(isAllowedGatewayRequest('GET', `/${VALID}%2f`)).toBe(false)
    expect(isAllowedGatewayRequest('GET', `//${VALID}`)).toBe(false)
    expect(isAllowedGatewayRequest('GET', '/../secret')).toBe(false)
    expect(isAllowedGatewayRequest('GET', '/short')).toBe(false)
    expect(isAllowedGatewayRequest('GET', `/${VALID}.html`)).toBe(false)
    expect(gatewayDocumentId(`/${VALID}`)).toBe(VALID)
    expect(gatewayDocumentId('/nope')).toBe(null)
  })
})
