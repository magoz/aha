import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderClaims } from './claims-render.js'
import { ClaimsSchema } from './claims-schema.js'
import { CLAIMS_CSS } from './claims-css.js'

/**
 * claims component definition. Findings with confidence badges and [n]
 * citation links into the page's sources anchors. Cited ids must be
 * well-formed and unique per finding; an id no sources entry defines is
 * a build error pointing at the exact path.
 */

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

const MAX_CLAIMS = 30

function checkClaim(
  request: JsonRenderRequest,
  statement: string,
  sources: ReadonlyArray<string> | undefined,
  index: number
): Effect.Effect<void, BlockDecodeError> {
  if (statement.trim().length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'claims',
        path: `claims[${String(index)}].statement`,
        detail: 'expected a non-empty statement'
      })
    )
  }

  if (sources === undefined) {
    return Effect.void
  }

  const seen: Array<string> = []

  for (let position = 0; position < sources.length; position += 1) {
    const raw = sources[position]

    if (raw === undefined) {
      continue
    }

    const id = raw.trim()

    if (!ID_PATTERN.test(id)) {
      return Effect.fail(
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'claims',
          path: `claims[${String(index)}].sources[${String(position)}]`,
          detail: `unknown source id "${raw}": use the id of a sources entry on this page, e.g. "r2-pricing"`
        })
      )
    }

    if (seen.includes(id)) {
      return Effect.fail(
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'claims',
          path: `claims[${String(index)}].sources[${String(position)}]`,
          detail: `duplicate source id "${id}" in one finding`
        })
      )
    }

    seen.push(id)
  }

  return Effect.void
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(ClaimsSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'claims',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.claims.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'claims',
            path: 'claims',
            detail: 'expected at least one finding'
          })
        )
      }

      if (decoded.claims.length > MAX_CLAIMS) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'claims',
            path: 'claims',
            detail: `expected at most ${String(MAX_CLAIMS)} findings`
          })
        )
      }

      return Effect.forEach(decoded.claims, (claim, index) =>
        checkClaim(request, claim.statement, claim.sources, index)
      ).pipe(Effect.map(() => renderClaims(decoded, { idPrefix: request.idPrefix })))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Eval-host findings",
  "claims": [
    {
      "statement": "Serving the eval artifacts from R2 keeps egress free, holding the nightly run under five cents.",
      "confidence": "medium",
      "sources": ["r2-pricing"]
    },
    {
      "statement": "Split DNS routes the gateway hostname to the box on the tailnet and to Vercel off it, so one URL serves both paths.",
      "confidence": "high",
      "sources": ["tailnet-dns"]
    },
    {
      "statement": "Cron limits may rise on a future plan, which would reopen the Vercel option.",
      "confidence": "low"
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'eval-host-findings',
    title: 'Eval-host findings',
    caption: 'Three findings; the first two cite the sources example ids in matching order.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const claimsComponent: CatalogComponent = {
  name: 'claims',
  category: 'research',
  summary: 'Findings with text confidence badges and [n] links into the sources list.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(ClaimsSchema),
  css: CLAIMS_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
