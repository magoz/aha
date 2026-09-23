import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderLineChart } from './line-chart-render.js'
import { LineChartSchema } from './line-chart-schema.js'
import { LINE_CHART_CSS } from './line-chart-css.js'

/**
 * line-chart component definition. The reference implementation for chart
 * components: Effect Schema at the boundary, pure renderer shared with the
 * browser bundle.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(LineChartSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'line-chart',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.series.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'line-chart',
            path: 'series',
            detail: 'expected at least one series'
          })
        )
      }

      return Effect.succeed(
        renderLineChart(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Intelligence vs cost per task",
  "x": { "kind": "number", "label": "cost per task (USD, log scale)", "scale": "log" },
  "y": { "label": "benchmark score" },
  "series": [
    {
      "name": "Arbor",
      "highlight": true,
      "values": [
        { "x": 0.002, "y": 41 },
        { "x": 0.009, "y": 58 },
        { "x": 0.05, "y": 71 },
        { "x": 0.3, "y": 82 },
        { "x": 1.8, "y": 89 }
      ]
    },
    {
      "name": "Beacon",
      "values": [
        { "x": 0.002, "y": 38 },
        { "x": 0.009, "y": 52 },
        { "x": 0.05, "y": 66 },
        { "x": 0.3, "y": 76 },
        { "x": 1.8, "y": 83 }
      ]
    },
    {
      "name": "Cinder",
      "values": [
        { "x": 0.002, "y": 44 },
        { "x": 0.009, "y": 55 },
        { "x": 0.05, "y": 64 },
        { "x": 0.3, "y": 72 },
        { "x": 1.8, "y": 78 }
      ]
    },
    {
      "name": "Drift",
      "values": [
        { "x": 0.002, "y": 35 },
        { "x": 0.009, "y": 48 },
        { "x": 0.05, "y": 62 },
        { "x": 0.3, "y": 74 },
        { "x": 1.8, "y": 85 }
      ]
    },
    {
      "name": "Ember",
      "values": [
        { "x": 0.002, "y": 40 },
        { "x": 0.009, "y": 50 },
        { "x": 0.05, "y": 60 },
        { "x": 0.3, "y": 69 },
        { "x": 1.8, "y": 75 }
      ]
    },
    {
      "name": "Flint",
      "values": [
        { "x": 0.002, "y": 33 },
        { "x": 0.009, "y": 45 },
        { "x": 0.05, "y": 58 },
        { "x": 0.3, "y": 70 },
        { "x": 1.8, "y": 80 }
      ]
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'intelligence-vs-cost',
    title: 'Intelligence vs cost per task',
    caption: 'Fig. 1. Six models across five effort levels; cost axis is logarithmic.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const lineChartComponent: CatalogComponent = {
  name: 'line-chart',
  category: 'charts',
  summary: 'Multiple series over numeric, time or category x, with optional log scales.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(LineChartSchema),
  css: LINE_CHART_CSS,
  clientBundle: 'line-chart.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
