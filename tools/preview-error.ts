import { Schema } from 'effect'

export class PreviewUsageError extends Schema.TaggedError<PreviewUsageError>()(
  'PreviewUsageError',
  {
    message: Schema.String
  }
) {}

export class PreviewFailure extends Schema.TaggedError<PreviewFailure>()('PreviewFailure', {
  message: Schema.String
}) {}
