import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderHistogram } from './histogram-render.js'
import { HistogramSchema } from './histogram-schema.js'
import { HISTOGRAM_CSS } from './histogram-css.js'

/**
 * histogram component definition. A binned distribution with automatic
 * nice bins and an optional marker line, e.g. the median.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(HistogramSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'histogram',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.values.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'histogram',
            path: 'values',
            detail: 'expected at least one value'
          })
        )
      }

      return Effect.succeed(
        renderHistogram(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Nightly end-to-end run (minutes)",
  "label": "minutes",
  "marker": { "value": 21.5, "label": "median 21.5" },
  "format": { "digits": 0 },
  "values": [18, 19, 19, 20, 20, 20, 21, 21, 21, 21, 22, 22, 22, 23, 23, 24, 24, 25, 26, 28, 31, 34]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'e2e-minutes',
    title: 'Nightly end-to-end run',
    caption: 'Fig. 1. Twenty-two nightly runs; the dashed line marks the median.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const histogramComponent: CatalogComponent = {
  name: 'histogram',
  category: 'charts',
  summary: 'Binned distribution with automatic nice bins and an optional marker line.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(HistogramSchema),
  css: HISTOGRAM_CSS,
  clientBundle: 'histogram.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
