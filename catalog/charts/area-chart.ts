import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderAreaChart } from './area-chart-render.js'
import { AreaChartSchema } from './area-chart-schema.js'
import { AREA_CHART_CSS } from './area-chart-css.js'

/**
 * area-chart component definition. Stacked or overlapping areas over a
 * numeric or time axis, with an optional 100% share mode.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(AreaChartSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'area-chart',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.series.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'area-chart',
            path: 'series',
            detail: 'expected at least one series'
          })
        )
      }

      return Effect.succeed(
        renderAreaChart(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const STACKED_JSON = `{
  "title": "Active workspaces by plan (thousands)",
  "mode": "stacked",
  "x": { "kind": "time", "label": "week" },
  "y": { "label": "workspaces" },
  "series": [
    {
      "name": "Team",
      "values": [
        { "x": "2026-07-06", "y": 41 },
        { "x": "2026-07-13", "y": 44 },
        { "x": "2026-07-20", "y": 43 },
        { "x": "2026-07-27", "y": 47 },
        { "x": "2026-08-03", "y": 50 },
        { "x": "2026-08-10", "y": 52 },
        { "x": "2026-08-17", "y": 55 },
        { "x": "2026-08-24", "y": 58 }
      ]
    },
    {
      "name": "Business",
      "highlight": true,
      "values": [
        { "x": "2026-07-06", "y": 18 },
        { "x": "2026-07-13", "y": 20 },
        { "x": "2026-07-20", "y": 22 },
        { "x": "2026-07-27", "y": 23 },
        { "x": "2026-08-03", "y": 26 },
        { "x": "2026-08-10", "y": 29 },
        { "x": "2026-08-17", "y": 31 },
        { "x": "2026-08-24", "y": 34 }
      ]
    },
    {
      "name": "Starter",
      "values": [
        { "x": "2026-07-06", "y": 62 },
        { "x": "2026-07-13", "y": 60 },
        { "x": "2026-07-20", "y": 61 },
        { "x": "2026-07-27", "y": 58 },
        { "x": "2026-08-03", "y": 57 },
        { "x": "2026-08-10", "y": 55 },
        { "x": "2026-08-17", "y": 54 },
        { "x": "2026-08-24", "y": 52 }
      ]
    }
  ]
}`

const PERCENT_JSON = `{
  "title": "Workspace mix by plan (share)",
  "mode": "stacked",
  "percent": true,
  "x": { "kind": "time", "label": "week" },
  "series": [
    {
      "name": "Team",
      "values": [
        { "x": "2026-07-06", "y": 41 },
        { "x": "2026-07-20", "y": 43 },
        { "x": "2026-08-03", "y": 50 },
        { "x": "2026-08-17", "y": 55 },
        { "x": "2026-08-24", "y": 58 }
      ]
    },
    {
      "name": "Business",
      "highlight": true,
      "values": [
        { "x": "2026-07-06", "y": 18 },
        { "x": "2026-07-20", "y": 22 },
        { "x": "2026-08-03", "y": 26 },
        { "x": "2026-08-17", "y": 31 },
        { "x": "2026-08-24", "y": 34 }
      ]
    },
    {
      "name": "Starter",
      "values": [
        { "x": "2026-07-06", "y": 62 },
        { "x": "2026-07-20", "y": 61 },
        { "x": "2026-08-03", "y": 57 },
        { "x": "2026-08-17", "y": 54 },
        { "x": "2026-08-24", "y": 52 }
      ]
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'workspaces-total',
    title: 'Active workspaces by plan',
    caption: 'Fig. 1. Stacked areas sum to the total each week.',
    json: STACKED_JSON,
    markup: null,
    markupKind: null
  },
  {
    id: 'workspaces-share',
    title: 'Workspace mix by plan',
    caption: 'Fig. 2. The same data normalised to 100% shows the mix shifting.',
    json: PERCENT_JSON,
    markup: null,
    markupKind: null
  }
]

export const areaChartComponent: CatalogComponent = {
  name: 'area-chart',
  category: 'charts',
  summary: 'Stacked or overlapping areas over numeric or time x, with an optional 100% mode.',
  inputKind: 'json',
  fields: describeSchemaFields(AreaChartSchema),
  css: AREA_CHART_CSS,
  clientBundle: 'area-chart.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
