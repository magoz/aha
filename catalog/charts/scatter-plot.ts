import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderScatterPlot } from './scatter-plot-render.js'
import { ScatterPlotSchema } from './scatter-plot-schema.js'
import { SCATTER_PLOT_CSS } from './scatter-plot-css.js'

/**
 * scatter-plot component definition. X/y points with optional size and
 * group encodings, labels on selected points, an optional trend line and
 * log axes.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(ScatterPlotSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'scatter-plot',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.points.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'scatter-plot',
            path: 'points',
            detail: 'expected at least one point'
          })
        )
      }

      return Effect.succeed(
        renderScatterPlot(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "p95 latency vs payload by region",
  "trend": true,
  "x": { "label": "payload (kB)" },
  "y": { "label": "p95 (ms)" },
  "points": [
    { "x": 12, "y": 84, "group": "east", "size": 420 },
    { "x": 18, "y": 96, "group": "east", "size": 610 },
    { "x": 24, "y": 118, "group": "east", "size": 880 },
    { "x": 31, "y": 141, "group": "east", "size": 1120 },
    { "x": 42, "y": 188, "group": "east", "size": 1590, "label": "east-42kB spike" },
    { "x": 11, "y": 92, "group": "west", "size": 380 },
    { "x": 19, "y": 104, "group": "west", "size": 590 },
    { "x": 27, "y": 122, "group": "west", "size": 940 },
    { "x": 35, "y": 149, "group": "west", "size": 1210 },
    { "x": 9, "y": 71, "group": "north", "size": 290 },
    { "x": 15, "y": 88, "group": "north", "size": 470 },
    { "x": 22, "y": 101, "group": "north", "size": 720, "label": "north edge cache" },
    { "x": 29, "y": 129, "group": "north", "size": 980 }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'latency-payload',
    title: 'Latency vs payload by region',
    caption: 'Fig. 1. Circle area encodes requests; the dashed line is least squares.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const scatterPlotComponent: CatalogComponent = {
  name: 'scatter-plot',
  category: 'charts',
  summary: 'X/y points with size and group encodings, labels, a trend line and log axes.',
  inputKind: 'json',
  fields: describeSchemaFields(ScatterPlotSchema),
  css: SCATTER_PLOT_CSS,
  clientBundle: 'scatter-plot.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
