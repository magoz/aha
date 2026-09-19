import { createServer } from 'node:http'
import type { Server } from 'node:http'

import { S3Client } from '@aws-sdk/client-s3'
import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest'
import { Effect, Predicate, Schema } from 'effect'

import { parsePlanId } from '../lib/plan-id.js'
import { makeS3Storage } from '../lib/storage-s3.js'
import { htmlBytes } from './helpers.js'

const ID_A = 'AAAAAAAAAAAAAAAAAAAAAA'

const ID_B = 'BBBBBBBBBBBBBBBBBBBBBB'

const SAMPLE = '<!doctype html><html><body><p>s3 stub fixture</p></body></html>'

const CURRENT_ETAG = '"current-etag"'

const PUT_ETAG = '"v2-put"'

interface SeenPut {
  readonly ifMatch: string | null
}

function headerFirst(value: string | Array<string> | undefined): string | null {
  if (value === undefined) {
    return null
  }

  if (Array.isArray(value)) {
    const first = value[0]

    return first ?? null
  }

  return value
}

function listPage(prefix: string, token: string | null): string {
  if (prefix === 'public/') {
    return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>test-bucket</Name><Prefix>public/</Prefix><KeyCount>1</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>public/${ID_A}</Key></Contents></ListBucketResult>`
  }

  if (token === 't1') {
    return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>test-bucket</Name><Prefix>plans/</Prefix><KeyCount>1</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>plans/${ID_B}.html</Key><ETag>"e-page2"</ETag></Contents></ListBucketResult>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>test-bucket</Name><Prefix>plans/</Prefix><KeyCount>1</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>true</IsTruncated><NextContinuationToken>t1</NextContinuationToken><Contents><Key>plans/${ID_A}.html</Key><ETag>"e-page1"</ETag></Contents></ListBucketResult>`
}

function preconditionFailedXml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Error><Code>PreconditionFailed</Code><Message>stale</Message><RequestId>stub</RequestId></Error>'
}

const AddressSchema = Schema.Struct({ port: Schema.Number })

function listenEphemeral(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      Effect.runPromise(
        Schema.decodeUnknownEffect(AddressSchema)(server.address()).pipe(
          Effect.map((decoded) => decoded.port),
          Effect.orElseSucceed(() => -1)
        )
      ).then((found) => {
        if (found < 0) {
          reject(new Error('no address'))
        } else {
          resolve(found)
        }
      }, reject)
    })
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve()
    })
  })
}

describe('s3 storage against a stub S3 endpoint', () => {
  let server: Server | null = null
  let port = 0
  let puts: Array<SeenPut> = []
  let lists: Array<string> = []

  beforeEach(async () => {
    puts = []
    lists = []
    server = createServer((req, res) => {
      const parsed = new URL(req.url ?? '/', 'http://localhost')

      if (req.method === 'PUT' && parsed.pathname.startsWith('/test-bucket/plans/')) {
        req.resume()
        req.on('end', () => {
          const ifMatch = headerFirst(req.headers['if-match'])
          puts.push({ ifMatch })

          if (ifMatch !== null && ifMatch !== CURRENT_ETAG) {
            res.statusCode = 412
            res.setHeader('content-type', 'application/xml')
            res.end(preconditionFailedXml())

            return
          }

          res.statusCode = 200
          res.setHeader('etag', PUT_ETAG)
          res.end()
        })

        return
      }

      if (req.method === 'GET' && parsed.searchParams.get('list-type') === '2') {
        lists.push(req.url ?? '')

        res.statusCode = 200
        res.setHeader('content-type', 'application/xml')
        res.end(
          listPage(
            parsed.searchParams.get('prefix') ?? '',
            parsed.searchParams.get('continuation-token')
          )
        )

        return
      }

      res.statusCode = 500
      res.end('unexpected stub request')
    })
    port = await listenEphemeral(server)
  })

  afterEach(async () => {
    if (server !== null) {
      await closeServer(server)
      server = null
    }
  })

  const makeStorage = () => {
    const client = new S3Client({
      region: 'us-east-1',
      endpoint: `http://127.0.0.1:${String(port)}`,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      forcePathStyle: true
    })

    return makeS3Storage(client, 'test-bucket')
  }

  it.effect('putDocument sends If-Match and returns the PUT ETag', () =>
    Effect.gen(function* () {
      const storage = makeStorage()
      const id = yield* parsePlanId(ID_A)

      const etag = yield* storage.putDocument(id, htmlBytes(SAMPLE), {
        ifMatch: CURRENT_ETAG,
        contentType: 'text/html; charset=utf-8'
      })

      expect(etag).toBe(PUT_ETAG)
      expect(puts.length).toBe(1)
      expect(puts[0]?.ifMatch).toBe(CURRENT_ETAG)
    })
  )

  it.effect('putDocument omits If-Match when no precondition is given', () =>
    Effect.gen(function* () {
      const storage = makeStorage()
      const id = yield* parsePlanId(ID_A)

      const etag = yield* storage.putDocument(id, htmlBytes(SAMPLE), {
        ifMatch: null,
        contentType: 'text/html; charset=utf-8'
      })

      expect(etag).toBe(PUT_ETAG)
      expect(puts.length).toBe(1)
      expect(puts[0]?.ifMatch).toBe(null)
    })
  )

  it.effect('putDocument maps a 412 response to PreconditionFailed', () =>
    Effect.gen(function* () {
      const storage = makeStorage()
      const id = yield* parsePlanId(ID_A)

      const failure = yield* Effect.flip(
        storage.putDocument(id, htmlBytes(SAMPLE), {
          ifMatch: '"stale-etag"',
          contentType: 'text/html; charset=utf-8'
        })
      )

      expect(Predicate.isTagged(failure, 'PreconditionFailed')).toBe(true)
      expect(puts.length).toBe(1)
    })
  )

  it.effect('listDocuments follows pagination for both prefixes', () =>
    Effect.gen(function* () {
      const storage = makeStorage()
      const entries = yield* storage.listDocuments()

      expect(entries.length).toBe(2)
      expect(lists.some((query) => query.includes('continuation-token=t1'))).toBe(true)

      const first = entries.find((entry) => entry.id === ID_A)
      const second = entries.find((entry) => entry.id === ID_B)

      expect(first?.isPublic).toBe(true)
      expect(first?.etag).toBe('"e-page1"')
      expect(second?.isPublic).toBe(false)
      expect(second?.etag).toBe('"e-page2"')
    })
  )
})
