import type {
  LengthGuard,
  R2BucketLike,
  R2ListOptionsLike,
  R2ListingLike,
  R2ObjectInfo,
  R2ObjectWithBody,
  R2PutOptionsLike
} from '../lib/storage-r2.js'
import type { ByteStream } from '../lib/storage.js'
import { collect, streamOf } from './fake-storage.js'

interface FakeObject {
  readonly body: Uint8Array
  readonly etag: string
  readonly contentType: string | undefined
  readonly customMetadata: Readonly<Record<string, string>>
}

// In-memory stand-in for the Workers R2 binding: conditional puts, strongly consistent reads and
// paginated listing (small pages, so cursors are exercised).
export interface FakeR2Bucket extends R2BucketLike {
  readonly objects: Map<string, FakeObject>
  failAll: boolean
}

const PAGE_SIZE = 2

function info(key: string, object: FakeObject): R2ObjectInfo {
  return {
    key,
    size: object.body.length,
    httpEtag: object.etag,
    httpMetadata: { contentType: object.contentType },
    customMetadata: object.customMetadata
  }
}

function unquote(value: string): string {
  return value.trim().replace(/^W\//, '').replace(/^"|"$/g, '')
}

export function createFakeR2Bucket(): FakeR2Bucket {
  const objects = new Map<string, FakeObject>()
  let version = 0

  const bucket: FakeR2Bucket = {
    objects,
    failAll: false,
    async head(key) {
      if (bucket.failAll) throw new Error('injected')
      const object = objects.get(key)

      return object === undefined ? null : info(key, object)
    },
    async get(key): Promise<R2ObjectWithBody | null> {
      if (bucket.failAll) throw new Error('injected')
      const object = objects.get(key)

      return object === undefined ? null : { ...info(key, object), body: streamOf(object.body) }
    },
    async put(key, value: ByteStream | string, options?: R2PutOptionsLike) {
      if (bucket.failAll) throw new Error('injected')

      const body =
        value instanceof ReadableStream ? await collect(value) : new TextEncoder().encode(value)

      const current = objects.get(key)
      const ifNoneMatch = options?.onlyIf?.get('if-none-match') ?? null
      const ifMatch = options?.onlyIf?.get('if-match') ?? null

      if (ifNoneMatch === '*' && current !== undefined) {
        return null
      }

      if (
        ifMatch !== null &&
        (current === undefined || unquote(current.etag) !== unquote(ifMatch))
      ) {
        return null
      }

      version += 1

      const stored: FakeObject = {
        body,
        etag: `"etag-${String(version)}"`,
        contentType: options?.httpMetadata?.contentType,
        customMetadata: options?.customMetadata ?? {}
      }

      objects.set(key, stored)

      return info(key, stored)
    },
    async delete(key) {
      if (bucket.failAll) throw new Error('injected')
      objects.delete(key)
    },
    async list(options: R2ListOptionsLike): Promise<R2ListingLike> {
      if (bucket.failAll) throw new Error('injected')

      const keys = Array.from(objects.keys())
        .filter((key) => key.startsWith(options.prefix))
        .sort()

      const start = options.cursor === undefined ? 0 : Number(options.cursor)
      const page = keys.slice(start, start + PAGE_SIZE)

      const listed = page.flatMap((key) => {
        const object = objects.get(key)

        if (object === undefined) {
          return []
        }

        const entry = info(key, object)

        return [
          options.include.includes('customMetadata')
            ? entry
            : { ...entry, customMetadata: undefined }
        ]
      })

      const next = start + PAGE_SIZE

      return next < keys.length
        ? { objects: listed, truncated: true, cursor: String(next) }
        : { objects: listed, truncated: false }
    }
  }

  return bucket
}

// Mirrors `FixedLengthStream`: passes bytes through and errors when the total differs.
export const countingLengthGuard: LengthGuard = (body, length) => {
  let seen = 0

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.length

        if (seen > length) {
          controller.error(new Error('body longer than declared'))
        } else {
          controller.enqueue(chunk)
        }
      },
      flush(controller) {
        if (seen !== length) {
          controller.error(new Error('body shorter than declared'))
        }
      }
    })
  )
}
