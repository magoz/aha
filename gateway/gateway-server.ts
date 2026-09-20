import { createServer } from 'node:http'
import type { IncomingHttpHeaders, Server } from 'node:http'

import { gatewayDocumentId, isAllowedGatewayRequest } from './gateway-policy.js'
import type { HeaderMap } from '../lib/headers.js'
import { withSecurityHeaders } from '../lib/security-headers.js'

const UPSTREAM_ENV = 'AHA_UPSTREAM_URL'

const TOKEN_ENV = 'AHA_PRIVATE_READ_TOKEN'

function insecureLoopbackAllowed(): boolean {
  return process.env['AHA_GATEWAY_INSECURE_LOOPBACK'] === '1'
}

function isLoopbackHttp(raw: string): boolean {
  if (!raw.startsWith('http://')) {
    return false
  }

  const rest = raw.slice('http://'.length)
  const host = rest.split('/')[0] ?? ''
  const bare = host.split(':')[0] ?? ''

  return bare === '127.0.0.1' || bare === 'localhost' || bare === '::1'
}

function upstreamBase(): string | null {
  const raw = process.env[UPSTREAM_ENV]

  if (raw === undefined || raw.length === 0) {
    return null
  }

  if (raw.startsWith('https://')) {
    return raw.replace(/\/$/, '')
  }

  // Test and development only: explicit opt-in for loopback http upstreams.
  // Production stays https-only.
  if (insecureLoopbackAllowed() && isLoopbackHttp(raw)) {
    return raw.replace(/\/$/, '')
  }

  return null
}

function privateToken(): string | null {
  const raw = process.env[TOKEN_ENV]

  if (raw === undefined || raw.length === 0) {
    return null
  }

  return raw
}

function forwardedHeaders(incoming: IncomingHttpHeaders): HeaderMap {
  const out: HeaderMap = {}
  const ifNoneMatch = incoming['if-none-match']

  if (Array.isArray(ifNoneMatch)) {
    const first = ifNoneMatch[0]

    if (first !== undefined) {
      out['if-none-match'] = first
    }
  } else if (ifNoneMatch !== undefined) {
    out['if-none-match'] = ifNoneMatch
  }

  return out
}

function sendStatus(
  res: {
    statusCode: number
    setHeader: (name: string, value: string) => void
    end: (body?: string) => void
  },
  status: number,
  body: string
): void {
  const headers = withSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' })
  res.statusCode = status

  for (const key of Object.keys(headers)) {
    const value = headers[key]

    if (value !== undefined) {
      res.setHeader(key, value)
    }
  }

  res.end(body)
}

export function startPrivateGateway(port: number): Server {
  const server = createServer((req, res) => {
    void (async () => {
      const base = upstreamBase()
      const token = privateToken()

      if (base === null || token === null) {
        sendStatus(res, 500, 'gateway misconfigured')

        return
      }

      const method = (req.method ?? 'GET').toUpperCase()
      const rawUrl = req.url ?? '/'
      const pathname = rawUrl.split('?')[0] ?? '/'

      if (!isAllowedGatewayRequest(method, pathname)) {
        sendStatus(res, 404, 'not found')

        return
      }

      const id = gatewayDocumentId(pathname)

      if (id === null) {
        sendStatus(res, 404, 'not found')

        return
      }

      const upstreamHeaders: HeaderMap = {
        authorization: `Bearer ${token}`,
        ...forwardedHeaders(req.headers)
      }

      const upstreamUrl = `${base}/${id}`

      let upstream: Response

      try {
        upstream = await fetch(upstreamUrl, {
          method,
          headers: upstreamHeaders,
          redirect: 'manual'
        })
      } catch {
        sendStatus(res, 502, 'upstream unavailable')

        return
      }

      if (upstream.status !== 304 && upstream.status >= 300 && upstream.status < 400) {
        await upstream.arrayBuffer().catch(() => null)
        sendStatus(res, 502, 'upstream redirect refused')

        return
      }

      const headers = withSecurityHeaders({})
      const contentType = upstream.headers.get('content-type')
      const etag = upstream.headers.get('etag')
      const contentLength = upstream.headers.get('content-length')

      if (contentType !== null) {
        headers['content-type'] = contentType
      }

      if (etag !== null) {
        headers['etag'] = etag
      }

      if (contentLength !== null) {
        headers['content-length'] = contentLength
      }

      res.statusCode = upstream.status

      for (const key of Object.keys(headers)) {
        const value = headers[key]

        if (value !== undefined) {
          res.setHeader(key, value)
        }
      }

      if (method === 'HEAD' || upstream.status === 304) {
        await upstream.arrayBuffer().catch(() => null)
        res.end()

        return
      }

      const bytes = await upstream.arrayBuffer().catch(() => null)

      if (bytes === null) {
        sendStatus(res, 502, 'upstream unavailable')

        return
      }

      res.end(Buffer.from(bytes))
    })()
  })

  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`aha private gateway on http://127.0.0.1:${String(port)}\n`)
  })

  return server
}
