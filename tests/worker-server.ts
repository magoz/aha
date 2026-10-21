import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

import { handleWorkerRequest } from '../server/worker.js'
import type { WorkerEnv } from '../server/worker.js'
import { countingLengthGuard } from './fake-r2-bucket.js'

async function readAll(incoming: IncomingMessage): Promise<Buffer<ArrayBuffer>> {
  const chunks: Array<Buffer> = []

  for await (const chunk of incoming) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }

  const merged = Buffer.alloc(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0

  for (const chunk of chunks) {
    chunk.copy(merged, offset)
    offset += chunk.length
  }

  return merged
}

async function toRequest(incoming: IncomingMessage): Promise<Request> {
  const headers = new Headers()

  for (let index = 0; index + 1 < incoming.rawHeaders.length; index += 2) {
    headers.append(incoming.rawHeaders[index] ?? '', incoming.rawHeaders[index + 1] ?? '')
  }

  const method = incoming.method ?? 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const init: RequestInit = { method, headers }

  if (hasBody) {
    init.body = await readAll(incoming)
  }

  return new Request(`http://${incoming.headers.host ?? 'localhost'}${incoming.url ?? '/'}`, init)
}

async function respond(response: Response, outgoing: ServerResponse): Promise<void> {
  outgoing.statusCode = response.status
  response.headers.forEach((value, name) => {
    outgoing.setHeader(name, value)
  })

  outgoing.end(Buffer.from(await response.arrayBuffer()))
}

// Serves the real Worker handler over Node HTTP so CLI tests exercise actual requests.
export function createWorkerServer(env: WorkerEnv): Server {
  return createServer((incoming, outgoing) => {
    toRequest(incoming)
      .then((request) => handleWorkerRequest(request, env, countingLengthGuard))
      .then((response) => respond(response, outgoing))
      .catch(() => {
        outgoing.statusCode = 500
        outgoing.end()
      })
  })
}
