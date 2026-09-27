import { Effect } from 'effect'
import slugify from 'slugify'

import { MAX_DOCUMENT_NAME_LENGTH, isNewDocumentName } from '../lib/plan-id.js'
import { CliUsageError } from './parser.js'

const TITLE_PATTERN = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i

const NAMED_ENTITIES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' ']
])

function decodeEntity(entity: string, body: string): string {
  if (body.startsWith('#x') || body.startsWith('#X')) {
    const code = Number.parseInt(body.slice(2), 16)

    return Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : entity
  }

  if (body.startsWith('#')) {
    const code = Number.parseInt(body.slice(1), 10)

    return Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : entity
  }

  return NAMED_ENTITIES.get(body.toLowerCase()) ?? entity
}

export function decodeBasicEntities(value: string): string {
  return value.replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z]+);/g, decodeEntity)
}

// Comments and SVG can hold their own <title> elements; only the document title names the page.
const IGNORED_MARKUP_PATTERN = /<!--[\s\S]*?-->|<svg\b[\s\S]*?<\/svg\s*>/gi

export function htmlTitle(html: string): string | null {
  const match = TITLE_PATTERN.exec(html.replace(IGNORED_MARKUP_PATTERN, ''))
  const raw = match?.[1]

  if (raw === undefined) {
    return null
  }

  return decodeBasicEntities(raw).replace(/\s+/g, ' ').trim()
}

function truncateSlug(slug: string): string {
  if (slug.length <= MAX_DOCUMENT_NAME_LENGTH) {
    return slug
  }

  const head = slug.slice(0, MAX_DOCUMENT_NAME_LENGTH)
  const endsOnBoundary = slug.charAt(MAX_DOCUMENT_NAME_LENGTH) === '-'
  const lastDash = head.lastIndexOf('-')
  const cut = endsOnBoundary || lastDash <= 0 ? head : head.slice(0, lastDash)

  return cut.replace(/-+$/, '')
}

export function slugifyDocumentName(value: string): string {
  return truncateSlug(slugify(value, { lower: true, strict: true }))
}

// Derives the document name for `aha upload`: an explicit `--name` wins, otherwise the page's
// `<title>`. Both are slugified; the server re-validates the result.
export function deriveDocumentName(
  explicit: string | null,
  html: string
): Effect.Effect<string, CliUsageError> {
  return Effect.suspend(() => {
    const source = explicit ?? htmlTitle(html) ?? ''
    const name = slugifyDocumentName(source)
    const origin = explicit === null ? 'the page <title>' : '--name'

    if (name.length === 0) {
      return Effect.fail(
        new CliUsageError({
          message: `cannot derive a document name from ${origin}; pass --name NAME (letters, digits and dashes)`
        })
      )
    }

    if (!isNewDocumentName(name)) {
      return Effect.fail(
        new CliUsageError({
          message: `document name "${name}" from ${origin} is reserved or invalid; pass a different --name NAME`
        })
      )
    }

    return Effect.succeed(name)
  })
}
