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

export class DocumentExists extends Schema.TaggedError<DocumentExists>()('DocumentExists', {
  id: Schema.String
}) {}

export class PayloadTooLarge extends Schema.TaggedError<PayloadTooLarge>()('PayloadTooLarge', {
  limitBytes: Schema.Number
}) {}

// Uploads must declare their size up front; a body without `Content-Length` is refused (411).
export class LengthRequired extends Schema.TaggedError<LengthRequired>()('LengthRequired', {}) {}

// The body was longer or shorter than its declared `Content-Length`; nothing was stored.
export class LengthMismatch extends Schema.TaggedError<LengthMismatch>()('LengthMismatch', {}) {}

export class UnsupportedMediaType extends Schema.TaggedError<UnsupportedMediaType>()(
  'UnsupportedMediaType',
  { contentType: Schema.String }
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()('Unauthorized', {}) {}

export class InvalidConfig extends Schema.TaggedError<InvalidConfig>()('InvalidConfig', {
  detail: Schema.String
}) {}

// A pairing code that is unknown, already used or expired. Deliberately one error for all three.
export class PairingInvalid extends Schema.TaggedError<PairingInvalid>()('PairingInvalid', {}) {}

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>()('SessionNotFound', {
  id: Schema.String
}) {}
