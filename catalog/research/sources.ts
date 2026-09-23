import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderSources } from './sources-render.js'
import { SourcesSchema } from './sources-schema.js'
import { SOURCES_CSS } from './sources-css.js'

/**
 * sources component definition. A numbered reference list with visible
 * mono URLs and stable src-<id> anchors for prose and claims citations.
 */

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

const MAX_SOURCES = 40

function checkEntry(
  request: JsonRenderRequest,
  title: string,
  url: string,
  publisher: string,
  supports: string,
  id: string | undefined,
  index: number,
  seen: Array<string>
): Effect.Effect<void, BlockDecodeError> {
  if (title.trim().length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'sources',
        path: `sources[${String(index)}].title`,
        detail: 'expected a non-empty title'
      })
    )
  }

  if (publisher.trim().length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'sources',
        path: `sources[${String(index)}].publisher`,
        detail: 'expected a non-empty publisher'
      })
    )
  }

  if (supports.trim().length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'sources',
        path: `sources[${String(index)}].supports`,
        detail: 'expected one line saying what this source supports'
      })
    )
  }

  const trimmedUrl = url.trim()

  if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://')) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'sources',
        path: `sources[${String(index)}].url`,
        detail: 'expected a URL starting with http:// or https://'
      })
    )
  }

  if (id !== undefined) {
    const trimmed = id.trim()

    if (!ID_PATTERN.test(trimmed)) {
      return Effect.fail(
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'sources',
          path: `sources[${String(index)}].id`,
          detail: 'expected letters, digits, dashes and underscores starting with a letter or digit'
        })
      )
    }

    if (seen.includes(trimmed)) {
      return Effect.fail(
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'sources',
          path: `sources[${String(index)}].id`,
          detail: `duplicate source id "${trimmed}"`
        })
      )
    }

    seen.push(trimmed)
  }

  return Effect.void
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(SourcesSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'sources',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.sources.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'sources',
            path: 'sources',
            detail: 'expected at least one source'
          })
        )
      }

      if (decoded.sources.length > MAX_SOURCES) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'sources',
            path: 'sources',
            detail: `expected at most ${String(MAX_SOURCES)} sources`
          })
        )
      }

      const seen: Array<string> = []

      return Effect.forEach(decoded.sources, (entry, index) =>
        checkEntry(
          request,
          entry.title,
          entry.url,
          entry.publisher,
          entry.supports,
          entry.id,
          index,
          seen
        )
      ).pipe(Effect.map(() => renderSources(decoded, { idPrefix: request.idPrefix })))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "What the eval-host decision rests on",
  "sources": [
    {
      "id": "r2-pricing",
      "title": "R2 pricing: zero egress fees",
      "url": "https://developers.cloudflare.com/r2/pricing/",
      "publisher": "Cloudflare",
      "published": "2026-08-01",
      "observed": "2026-09-20",
      "supports": "Egress from R2 is free, so the nightly eval pays storage plus requests only."
    },
    {
      "id": "tailnet-dns",
      "title": "Split DNS best practices",
      "url": "https://tailscale.com/kb/1745-dns-best-practices",
      "publisher": "Tailscale",
      "observed": "2026-09-20",
      "supports": "One hostname can resolve on the tailnet while the rest uses public DNS."
    },
    {
      "title": "Cron job limits",
      "url": "https://vercel.com/docs/cron-jobs",
      "publisher": "Vercel",
      "observed": "2026-09-19",
      "supports": "Cron invocations time out after a few minutes, too short for the full eval."
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'eval-host-evidence',
    title: 'What the eval-host decision rests on',
    caption: 'Three sources; the first two carry ids the claims example cites.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const sourcesComponent: CatalogComponent = {
  name: 'sources',
  category: 'research',
  summary: 'Numbered reference list with visible URLs and stable anchors for prose citations.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(SourcesSchema),
  css: SOURCES_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
