import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderBarChart } from './bar-chart-render.js'
import { BarChartSchema } from './bar-chart-schema.js'
import { BAR_CHART_CSS } from './bar-chart-css.js'

/**
 * bar-chart component definition. Vertical or horizontal, grouped or
 * stacked, with negatives diverging from zero.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(BarChartSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'bar-chart',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.categories.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'bar-chart',
            path: 'categories',
            detail: 'expected at least one category'
          })
        )
      }

      if (decoded.series.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'bar-chart',
            path: 'series',
            detail: 'expected at least one series'
          })
        )
      }

      for (const lane of decoded.series) {
        if (lane.values.length !== decoded.categories.length) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'bar-chart',
              path: `series.${lane.name}.values`,
              detail: `expected ${String(decoded.categories.length)} values, got ${String(lane.values.length)}`
            })
          )
        }
      }

      return Effect.succeed(
        renderBarChart(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const GROUPED_JSON = `{
  "title": "p95 change vs baseline (ms)",
  "mode": "grouped",
  "categories": ["checkout", "search", "feed", "profile"],
  "format": { "digits": 0 },
  "series": [
    {
      "name": "Arbor",
      "highlight": true,
      "values": [-42, 18, -12, 6]
    },
    {
      "name": "Beacon",
      "values": [-28, 31, 4, -9]
    },
    {
      "name": "Cinder",
      "values": [-15, 9, -22, 14]
    }
  ]
}`

const STACKED_JSON = `{
  "title": "On-call hours by team",
  "orientation": "horizontal",
  "mode": "stacked",
  "sorted": "desc",
  "categories": ["serve", "build", "observe", "release"],
  "series": [
    { "name": "pages", "values": [14, 6, 9, 4] },
    { "name": "tickets", "values": [22, 18, 12, 10] },
    { "name": "toil", "values": [8, 12, 6, 5] }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'latency-delta',
    title: 'Latency change vs baseline',
    caption: 'Fig. 1. Grouped bars diverging from zero; negatives are improvements.',
    json: GROUPED_JSON,
    markup: null,
    markupKind: null
  },
  {
    id: 'oncall-hours',
    title: 'On-call hours by team',
    caption: 'Fig. 2. Horizontal stacked bars, teams sorted by total load.',
    json: STACKED_JSON,
    markup: null,
    markupKind: null
  }
]

export const barChartComponent: CatalogComponent = {
  name: 'bar-chart',
  category: 'charts',
  summary: 'Vertical or horizontal bars, grouped or stacked, with negatives diverging from zero.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(BarChartSchema),
  css: BAR_CHART_CSS,
  clientBundle: 'bar-chart.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
