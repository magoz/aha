import { Schema } from 'effect'

export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()(
  'StorageUnavailable',
  { operation: Schema.String }
) {}

export class DocumentNotFound extends Schema.TaggedError<DocumentNotFound>()('DocumentNotFound', {
  id: Schema.String
}) {}

export class PreconditionFailed extends Schema.TaggedError<PreconditionFailed>()(
  'PreconditionFailed',
  { id: Schema.String }
) {}

export class PayloadTooLarge extends Schema.TaggedError<PayloadTooLarge>()('PayloadTooLarge', {
  limitBytes: Schema.Number
}) {}

export class UnsupportedMediaType extends Schema.TaggedError<UnsupportedMediaType>()(
  'UnsupportedMediaType',
  { contentType: Schema.String }
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()('Unauthorized', {}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()('Forbidden', {}) {}

export class InvalidConfig extends Schema.TaggedError<InvalidConfig>()('InvalidConfig', {
  detail: Schema.String
}) {}

export class UpstreamError extends Schema.TaggedError<UpstreamError>()('UpstreamError', {
  detail: Schema.String
}) {}

export class RequestBodyFailed extends Schema.TaggedError<RequestBodyFailed>()(
  'RequestBodyFailed',
  {}
) {}
