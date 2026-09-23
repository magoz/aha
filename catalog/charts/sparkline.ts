import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderSparkline } from './sparkline-render.js'
import { SparklineSchema } from './sparkline-schema.js'
import { SPARKLINE_CSS } from './sparkline-css.js'

/**
 * sparkline component definition. A tiny inline trend for prose or
 * tables, with an optional last value and min/max markers. Author it as a
 * div block so it can sit inside a table cell or between paragraphs.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(SparklineSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'sparkline',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.values.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'sparkline',
            path: 'values',
            detail: 'expected at least one value'
          })
        )
      }

      return Effect.succeed(renderSparkline(decoded, request.idPrefix))
    })
  )
}

const EXAMPLE_JSON = `{
  "label": "build",
  "format": { "digits": 1 },
  "values": [8.2, 7.9, 8.4, 9.1, 8.8, 12.6, 8.5, 8.1, 7.8, 8.3, 8.0, 7.6, 7.9, 7.4]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'build-minutes',
    title: 'Nightly build minutes',
    caption: 'A two-week build trend; the spike is the dependency bump.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const sparklineComponent: CatalogComponent = {
  name: 'sparkline',
  category: 'charts',
  summary: 'Tiny inline trend for prose or tables, with last value and min/max markers.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(SparklineSchema),
  css: SPARKLINE_CSS,
  clientBundle: 'sparkline.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
