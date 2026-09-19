import { Schema } from 'effect'

export const HTML_CONTENT_TYPE = 'text/html; charset=utf-8'

export const MAX_HTML_BYTES = 2 * 1024 * 1024

export class ContentTooLarge extends Schema.TaggedError<ContentTooLarge>()('ContentTooLarge', {
  limitBytes: Schema.Number
}) {}

export function isHtmlContentType(value: string): boolean {
  const lowered = value.toLowerCase()
  const main = lowered.split(';')[0]

  if (main === undefined) {
    return false
  }

  return main.trim() === 'text/html'
}

export function byteLengthOf(body: Uint8Array): number {
  return body.length
}

export function withinLimit(body: Uint8Array): boolean {
  return body.length <= MAX_HTML_BYTES
}
