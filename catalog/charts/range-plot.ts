import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderRangePlot } from './range-plot-render.js'
import { RangePlotSchema } from './range-plot-schema.js'
import { RANGE_PLOT_CSS } from './range-plot-css.js'

/**
 * range-plot component definition. A dumbbell per category: before and
 * after (or min and max) with the change highlighted.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(RangePlotSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'range-plot',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.rows.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'range-plot',
            path: 'rows',
            detail: 'expected at least one row'
          })
        )
      }

      return Effect.succeed(
        renderRangePlot(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "p95 latency before and after the rollout (ms)",
  "fromLabel": "before",
  "toLabel": "after",
  "format": { "digits": 0 },
  "rows": [
    { "label": "checkout", "a": 412, "b": 368, "highlight": true },
    { "label": "search", "a": 188, "b": 201 },
    { "label": "feed", "a": 265, "b": 231 },
    { "label": "profile", "a": 142, "b": 138 },
    { "label": "settings", "a": 96, "b": 104 }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'rollout-delta',
    title: 'Latency before and after the rollout',
    caption: 'Fig. 1. Hollow is before, solid is after; checkout is highlighted.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const rangePlotComponent: CatalogComponent = {
  name: 'range-plot',
  category: 'charts',
  summary: 'Dumbbell per category: before and after (or min and max) with the change shown.',
  inputKind: 'json',
  fields: describeSchemaFields(RangePlotSchema),
  css: RANGE_PLOT_CSS,
  clientBundle: 'range-plot.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
