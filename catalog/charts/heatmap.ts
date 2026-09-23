import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderHeatmap } from './heatmap-render.js'
import { HeatmapSchema } from './heatmap-schema.js'
import { HEATMAP_CSS } from './heatmap-css.js'

/**
 * heatmap component definition. A matrix of values over two categorical
 * axes with a sequential ink scale, a scale legend and cell tooltips.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(HeatmapSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'heatmap',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.rows.length === 0 || decoded.columns.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'heatmap',
            path: 'rows',
            detail: 'expected at least one row and one column'
          })
        )
      }

      if (decoded.values.length !== decoded.rows.length) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'heatmap',
            path: 'values',
            detail: `expected ${String(decoded.rows.length)} rows, got ${String(decoded.values.length)}`
          })
        )
      }

      for (const line of decoded.values) {
        if (line.length !== decoded.columns.length) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'heatmap',
              path: 'values',
              detail: `expected ${String(decoded.columns.length)} values per row, got ${String(line.length)}`
            })
          )
        }
      }

      return Effect.succeed(
        renderHeatmap(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Deploys by weekday and time block",
  "rows": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "columns": ["night", "morning", "afternoon", "evening"],
  "values": [
    [2, 18, 24, 9],
    [1, 22, 27, 11],
    [3, 19, 25, 8],
    [2, 21, 29, 12],
    [4, 16, 20, 6],
    [6, 5, 4, 3],
    [1, 2, 1, 1]
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'deploy-rhythm',
    title: 'Deploys by weekday and time block',
    caption: 'Fig. 1. Weekday afternoons carry releases; weekends are quiet.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const heatmapComponent: CatalogComponent = {
  name: 'heatmap',
  category: 'charts',
  summary: 'Matrix of values over two categorical axes with a sequential scale and legend.',
  inputKind: 'json',
  fields: describeSchemaFields(HeatmapSchema),
  css: HEATMAP_CSS,
  clientBundle: 'heatmap.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
