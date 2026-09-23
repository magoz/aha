import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderKeyFigures } from './key-figures-render.js'
import { KeyFiguresSchema } from './key-figures-schema.js'
import { KEY_FIGURES_CSS } from './key-figures-css.js'

/**
 * key-figures component definition. Headline numbers with signed deltas
 * and sparklines; static markup reads without scripts.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(KeyFiguresSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'key-figures',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.figures.length < 2 || decoded.figures.length > 6) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'key-figures',
            path: 'figures',
            detail: 'expected two to six figures'
          })
        )
      }

      return Effect.succeed(renderKeyFigures(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Overnight inference bill",
  "figures": [
    { "label": "tasks", "value": "41,208", "delta": "+3,112 vs Tue", "direction": "up", "trend": [31, 33, 32, 35, 34, 37, 38, 41] },
    { "label": "median latency", "value": "182", "unit": "ms", "delta": "-24 ms vs Tue", "direction": "down", "trend": [240, 228, 231, 214, 205, 198, 190, 182] },
    { "label": "cost per 1k", "value": "0.31", "unit": "USD", "delta": "+0.02 USD vs Tue", "direction": "up", "trend": [0.27, 0.28, 0.28, 0.29, 0.3, 0.29, 0.3, 0.31] },
    { "label": "error rate", "value": "0.4", "unit": "%", "delta": "-0.1 pts vs Tue", "direction": "down", "trend": [0.9, 0.8, 0.8, 0.7, 0.6, 0.6, 0.5, 0.4] }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'overnight-bill',
    title: 'Overnight inference bill',
    caption: 'Four headline numbers with signed deltas and mini trends.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const keyFiguresComponent: CatalogComponent = {
  name: 'key-figures',
  category: 'data',
  summary: 'Two to six headline numbers with signed deltas and sparkline trends.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(KeyFiguresSchema),
  css: KEY_FIGURES_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
