import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderDataTable } from './data-table-render.js'
import { DataTableSchema } from './data-table-schema.js'
import { DATA_TABLE_CSS } from './data-table-css.js'

/**
 * data-table component definition. Typed columns, sortable headers,
 * highlighted row, collapse past a threshold.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(DataTableSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'data-table',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.columns.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'data-table',
            path: 'columns',
            detail: 'expected at least one column'
          })
        )
      }

      return Effect.succeed(renderDataTable(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Model cost per 1k tasks",
  "sortable": true,
  "highlightRow": 0,
  "collapseAfter": 8,
  "columns": [
    { "key": "model", "label": "model", "type": "text" },
    { "key": "cost", "label": "cost / task", "type": "currency", "currency": "USD", "digits": 3 },
    { "key": "score", "label": "score", "type": "number", "digits": 1 },
    { "key": "win", "label": "win rate", "type": "percent", "digits": 0 },
    { "key": "eval", "label": "evaluated", "type": "date", "priority": "low" }
  ],
  "rows": [
    ["Arbor", 0.31, 82.4, 0.61, "2026-09-18"],
    ["Beacon", 0.28, 76.1, 0.55, "2026-09-18"],
    ["Cinder", 0.19, 72.9, 0.52, "2026-09-17"],
    ["Drift", 0.42, 84.7, 0.64, "2026-09-18"],
    ["Ember", 0.15, 69.3, 0.48, "2026-09-16"],
    ["Flint", 0.36, 80.2, 0.59, "2026-09-17"],
    ["Grove", 0.22, 74.8, 0.53, "2026-09-15"],
    ["Harbor", 0.51, 86.1, 0.66, "2026-09-18"],
    ["Iris", 0.12, 66.5, 0.44, "2026-09-14"],
    ["Jetty", 0.33, 79.0, 0.57, "2026-09-16"],
    ["Kestrel", 0.26, 77.6, 0.56, "2026-09-15"],
    ["Lumen", 0.48, 85.3, 0.63, "2026-09-17"],
    ["Meadow", 0.09, 62.1, 0.41, "2026-09-13"],
    ["North", 0.39, 81.7, 0.6, "2026-09-16"]
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'model-costs',
    title: 'Model cost per 1k tasks',
    caption: 'Table 1. Fourteen models; Arbor highlighted, long tail collapsed.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const dataTableComponent: CatalogComponent = {
  name: 'data-table',
  category: 'data',
  summary: 'Typed columns with sorting, a highlighted row, and collapse for long tables.',
  inputKind: 'json',
  fields: describeSchemaFields(DataTableSchema),
  css: DATA_TABLE_CSS,
  clientBundle: 'data-table.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
