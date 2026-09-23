import { Schema } from 'effect'

/**
 * Shared catalog errors. Boundary and shared errors use Schema.TaggedError;
 * each carries the block context a page author needs to find the fault.
 */

export class UnknownComponentError extends Schema.TaggedError<UnknownComponentError>()(
  'UnknownComponentError',
  {
    name: Schema.String
  }
) {
  get message(): string {
    return `unknown component: ${this.name}`
  }
}

export class BlockDecodeError extends Schema.TaggedError<BlockDecodeError>()('BlockDecodeError', {
  blockIndex: Schema.Number,
  component: Schema.String,
  path: Schema.String,
  detail: Schema.String
}) {
  get message(): string {
    if (this.path.length === 0) {
      return `block ${String(this.blockIndex)} (${this.component}): ${this.detail}`
    }

    return `block ${String(this.blockIndex)} (${this.component}): ${this.path}: ${this.detail}`
  }
}

export class ClientBundleMissingError extends Schema.TaggedError<ClientBundleMissingError>()(
  'ClientBundleMissingError',
  {
    name: Schema.String
  }
) {
  get message(): string {
    return `client bundle missing for ${this.name}: run pnpm build first`
  }
}

export class CatalogFileError extends Schema.TaggedError<CatalogFileError>()('CatalogFileError', {
  operation: Schema.String,
  path: Schema.String,
  detail: Schema.String
}) {
  get message(): string {
    return `cannot ${this.operation} file ${this.path}: ${this.detail}`
  }
}
