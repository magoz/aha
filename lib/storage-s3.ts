import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import type { ListObjectsV2CommandInput, PutObjectCommandInput } from '@aws-sdk/client-s3'
import { Effect, Layer, Predicate } from 'effect'

import type { ServiceConfig } from './config.js'
import {
  DocumentNotFound,
  InvalidConfig,
  PreconditionFailed,
  StorageUnavailable
} from './errors.js'
import { MAX_HTML_BYTES } from './html-limits.js'
import { documentKey, isPlanId, markerKey } from './plan-id.js'
import type { PlanId } from './plan-id.js'
import { AhaStorageTag } from './storage.js'
import type { DocumentHead, ListEntry, PutOptions, StoredDocument } from './storage.js'

interface AwsFailureMetadata {
  readonly httpStatusCode?: number
}

interface AwsFailure {
  readonly Code?: string
  readonly name?: string
  readonly $metadata?: AwsFailureMetadata
}

function isAwsFailure(value: unknown): value is AwsFailure {
  return Predicate.isObject(value) || Array.isArray(value)
}

function failureCode(cause: unknown): string | undefined {
  if (!isAwsFailure(cause)) {
    return undefined
  }

  const code = cause.Code

  if (code !== undefined) {
    return code
  }

  return cause.name
}

function failureStatus(cause: unknown): number | undefined {
  if (!isAwsFailure(cause)) {
    return undefined
  }

  const metadata = cause.$metadata

  if (metadata === undefined) {
    return undefined
  }

  return metadata.httpStatusCode
}

export function isMissing(cause: unknown): boolean {
  const code = failureCode(cause)

  if (code === 'NoSuchBucket') {
    return false
  }

  if (code === 'NotFound' || code === 'NoSuchKey') {
    return true
  }

  return failureStatus(cause) === 404
}

function isPreconditionFailed(cause: unknown): boolean {
  if (failureCode(cause) === 'PreconditionFailed') {
    return true
  }

  return failureStatus(cause) === 412
}

function toStorageError(operation: string): StorageUnavailable {
  return new StorageUnavailable({ operation })
}

function idFromDocumentKey(key: string): PlanId | null {
  if (!key.startsWith('aha/') || !key.endsWith('.html')) {
    return null
  }

  const id = key.slice(4, key.length - 5)

  if (!isPlanId(id)) {
    return null
  }

  return id
}

function idFromMarkerKey(key: string): PlanId | null {
  if (!key.startsWith('public/')) {
    return null
  }

  const id = key.slice(7)

  if (!isPlanId(id)) {
    return null
  }

  return id
}

function isByteIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  if (!Predicate.isObject(value) && !Array.isArray(value)) {
    return false
  }

  return Symbol.asyncIterator in value
}

function collectBounded(
  body: AsyncIterable<Uint8Array>,
  limit: number
): Promise<Uint8Array | null> {
  const run = async (): Promise<Uint8Array | null> => {
    const chunks: Array<Uint8Array> = []
    let total = 0

    for await (const chunk of body) {
      total += chunk.length

      if (total > limit) {
        return null
      }

      chunks.push(chunk)
    }

    const merged = new Uint8Array(total)
    let offset = 0

    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    return merged
  }

  return run()
}

interface ListedObject {
  readonly key: string
  readonly etag: string
}

const LIST_MAX_PAGES = 100

function listAllWithPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
  operation: string
): Effect.Effect<Array<ListedObject>, StorageUnavailable> {
  return Effect.gen(function* () {
    const items: Array<ListedObject> = []
    let continuation: string | undefined = undefined
    let truncated = true
    let pages = 0

    while (truncated) {
      if (pages >= LIST_MAX_PAGES) {
        return yield* new StorageUnavailable({ operation: 'listDocuments:too-many-pages' })
      }

      pages += 1

      const input: ListObjectsV2CommandInput = {
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000
      }

      if (continuation !== undefined) {
        input.ContinuationToken = continuation
      }

      const page = yield* Effect.tryPromise({
        try: () => client.send(new ListObjectsV2Command(input)),
        catch: () => toStorageError(operation)
      })

      for (const item of page.Contents ?? []) {
        if (item.Key === undefined) {
          continue
        }

        items.push({ key: item.Key, etag: item.ETag ?? '' })
      }

      truncated = page.IsTruncated ?? false
      continuation = page.NextContinuationToken
    }

    return items
  })
}

export function makeS3Storage(client: S3Client, bucket: string) {
  return AhaStorageTag.of({
    getDocument: (
      id: PlanId
    ): Effect.Effect<StoredDocument, StorageUnavailable | DocumentNotFound> =>
      Effect.gen(function* () {
        const fetched = yield* Effect.tryPromise({
          try: () => client.send(new GetObjectCommand({ Bucket: bucket, Key: documentKey(id) })),
          catch: (cause) =>
            isMissing(cause)
              ? new DocumentNotFound({ id })
              : toStorageError('getDocument:request-failed')
        })

        const rawBody = fetched.Body

        if (!isByteIterable(rawBody)) {
          return yield* new StorageUnavailable({ operation: 'getDocument:empty-body' })
        }

        const bounded = yield* Effect.tryPromise({
          try: () => collectBounded(rawBody, MAX_HTML_BYTES),
          catch: () => toStorageError('getDocument:read-failed')
        })

        if (bounded === null) {
          return yield* new StorageUnavailable({ operation: 'getDocument:too-large' })
        }

        const etag = fetched.ETag

        if (etag === undefined) {
          return yield* new StorageUnavailable({ operation: 'getDocument:missing-etag' })
        }

        return { body: bounded, contentType: 'text/html; charset=utf-8', etag }
      }),
    headDocument: (
      id: PlanId
    ): Effect.Effect<DocumentHead, StorageUnavailable | DocumentNotFound> =>
      Effect.tryPromise({
        try: () => client.send(new HeadObjectCommand({ Bucket: bucket, Key: documentKey(id) })),
        catch: (cause) =>
          isMissing(cause)
            ? new DocumentNotFound({ id })
            : toStorageError('headDocument:request-failed')
      }).pipe(
        Effect.map((head) => ({
          contentType: 'text/html; charset=utf-8',
          contentLength: head.ContentLength ?? 0,
          etag: head.ETag ?? ''
        }))
      ),
    putDocument: (
      id: PlanId,
      body: Uint8Array,
      options: PutOptions
    ): Effect.Effect<string, StorageUnavailable | DocumentNotFound | PreconditionFailed> =>
      Effect.gen(function* () {
        const input: PutObjectCommandInput = {
          Bucket: bucket,
          Key: documentKey(id),
          Body: body,
          ContentType: options.contentType
        }

        if (options.ifMatch !== null) {
          input.IfMatch = options.ifMatch
        }

        const put = yield* Effect.tryPromise({
          try: () => client.send(new PutObjectCommand(input)),
          catch: (cause) =>
            isPreconditionFailed(cause)
              ? new PreconditionFailed({ id })
              : toStorageError('putDocument:request-failed')
        })

        const etag = put.ETag

        if (etag === undefined) {
          return yield* new StorageUnavailable({ operation: 'putDocument:missing-etag' })
        }

        return etag
      }),
    deleteDocument: (id: PlanId): Effect.Effect<void, StorageUnavailable | DocumentNotFound> =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: () => client.send(new HeadObjectCommand({ Bucket: bucket, Key: documentKey(id) })),
          catch: (cause) =>
            isMissing(cause)
              ? new DocumentNotFound({ id })
              : toStorageError('deleteDocument:exists')
        })

        yield* Effect.tryPromise({
          try: () => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: documentKey(id) })),
          catch: () => toStorageError('deleteDocument:request-failed')
        })
      }),
    markerExists: (id: PlanId): Effect.Effect<boolean, StorageUnavailable> =>
      Effect.tryPromise({
        try: () => client.send(new HeadObjectCommand({ Bucket: bucket, Key: markerKey(id) })),
        catch: (cause) =>
          isMissing(cause)
            ? new DocumentNotFound({ id })
            : toStorageError('markerExists:request-failed')
      }).pipe(
        Effect.map(() => true),
        Effect.catchTag('DocumentNotFound', () => Effect.succeed(false))
      ),
    putMarker: (id: PlanId): Effect.Effect<void, StorageUnavailable> =>
      Effect.tryPromise({
        try: () =>
          client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: markerKey(id),
              Body: new Uint8Array(0),
              ContentType: 'application/octet-stream'
            })
          ),
        catch: () => toStorageError('putMarker:request-failed')
      }).pipe(Effect.asVoid),
    deleteMarker: (id: PlanId): Effect.Effect<void, StorageUnavailable> =>
      Effect.tryPromise({
        try: () => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: markerKey(id) })),
        catch: () => toStorageError('deleteMarker:request-failed')
      }).pipe(Effect.asVoid),
    listDocuments: (): Effect.Effect<ReadonlyArray<ListEntry>, StorageUnavailable> =>
      Effect.gen(function* () {
        const listed = yield* listAllWithPrefix(
          client,
          bucket,
          'aha/',
          'listDocuments:request-failed'
        )

        const markers = yield* listAllWithPrefix(client, bucket, 'public/', 'listDocuments:markers')

        const publicIds = new Set<string>()

        for (const item of markers) {
          const id = idFromMarkerKey(item.key)

          if (id !== null) {
            publicIds.add(id)
          }
        }

        const entries: Array<ListEntry> = []

        for (const item of listed) {
          const id = idFromDocumentKey(item.key)

          if (id === null) {
            continue
          }

          entries.push({ id, isPublic: publicIds.has(id), etag: item.etag })
        }

        return entries
      })
  })
}

export function s3StorageLayer(config: ServiceConfig): Layer.Layer<AhaStorageTag, InvalidConfig> {
  if (config.endpoint.trim().length === 0) {
    return Layer.effect(
      AhaStorageTag,
      Effect.fail(new InvalidConfig({ detail: 'missing R2_ENDPOINT' }))
    )
  }

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: false
  })

  return Layer.succeed(AhaStorageTag)(makeS3Storage(client, config.bucket))
}
