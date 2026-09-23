import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderComparisonMatrix } from './comparison-matrix-render.js'
import { ComparisonMatrixSchema } from './comparison-matrix-schema.js'
import { COMPARISON_MATRIX_CSS } from './comparison-matrix-css.js'

/**
 * comparison-matrix component definition. Options by criteria with typed
 * cells and an optional recommended column; static markup reads directly.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(ComparisonMatrixSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'comparison-matrix',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.options.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'comparison-matrix',
            path: 'options',
            detail: 'expected at least one option'
          })
        )
      }

      if (decoded.rows.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'comparison-matrix',
            path: 'rows',
            detail: 'expected at least one criterion row'
          })
        )
      }

      for (let index = 0; index < decoded.rows.length; index += 1) {
        const row = decoded.rows[index]

        if (row !== undefined && row.cells.length !== decoded.options.length) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'comparison-matrix',
              path: `rows[${String(index)}].cells`,
              detail: `expected ${String(decoded.options.length)} cells, got ${String(row.cells.length)}`
            })
          )
        }
      }

      return Effect.succeed(renderComparisonMatrix(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Where to run the nightly eval",
  "options": [
    { "name": "laptop" },
    { "name": "box", "recommended": true },
    { "name": "vercel cron" }
  ],
  "rows": [
    { "criterion": "gpu for rerank", "cells": [{ "mark": "no" }, { "mark": "yes" }, { "mark": "no" }] },
    { "criterion": "wakes from sleep", "cells": [{ "mark": "no" }, { "mark": "yes" }, { "mark": "yes" }] },
    { "criterion": "tailnet-only reads", "cells": [{ "mark": "partial" }, { "mark": "yes" }, { "mark": "no" }] },
    { "criterion": "cost per run", "cells": [{ "value": 0, "unit": "USD" }, { "value": 0.04, "unit": "USD" }, { "value": 0.4, "unit": "USD" }] },
    { "criterion": "p90 wall time", "cells": [{ "value": 42, "unit": "min" }, { "value": 11, "unit": "min" }, { "value": 9, "unit": "min" }] },
    { "criterion": "caveat", "cells": [{ "text": "sleeps mid-run" }, { "text": "needs wakeTimers" }, { "text": "no private reads" }] }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'nightly-eval',
    title: 'Where to run the nightly eval',
    caption: 'Table 2. Three options across six criteria; the box column is recommended.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const comparisonMatrixComponent: CatalogComponent = {
  name: 'comparison-matrix',
  category: 'data',
  summary: 'Options by criteria with typed cells and an optional recommended column.',
  inputKind: 'json',
  fields: describeSchemaFields(ComparisonMatrixSchema),
  css: COMPARISON_MATRIX_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
