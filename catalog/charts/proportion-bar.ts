import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderProportionBar } from './proportion-bar-render.js'
import { ProportionBarSchema } from './proportion-bar-schema.js'
import { PROPORTION_BAR_CSS } from './proportion-bar-css.js'

/**
 * proportion-bar component definition. One 100% bar or a small set of
 * them showing parts of a whole, labelled directly: a stand-in for pie
 * charts.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(ProportionBarSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'proportion-bar',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.bars.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'proportion-bar',
            path: 'bars',
            detail: 'expected at least one bar'
          })
        )
      }

      for (const bar of decoded.bars) {
        if (bar.parts.length === 0) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'proportion-bar',
              path: 'bars.parts',
              detail: 'expected at least one part per bar'
            })
          )
        }

        let total = 0

        for (const part of bar.parts) {
          if (part.value < 0) {
            return Effect.fail(
              new BlockDecodeError({
                blockIndex: request.blockIndex,
                component: 'proportion-bar',
                path: `bars.parts.${part.name}`,
                detail: 'expected a value of zero or more'
              })
            )
          }

          total += part.value
        }

        if (total <= 0) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'proportion-bar',
              path: 'bars.parts',
              detail: 'expected part values summing above zero'
            })
          )
        }
      }

      return Effect.succeed(
        renderProportionBar(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Request share by entry point",
  "bars": [
    {
      "label": "before the migration",
      "parts": [
        { "name": "edge", "value": 46 },
        { "name": "api", "value": 31 },
        { "name": "worker", "value": 15 },
        { "name": "cron", "value": 8 }
      ]
    },
    {
      "label": "after the migration",
      "parts": [
        { "name": "edge", "value": 58, "highlight": true },
        { "name": "api", "value": 26 },
        { "name": "worker", "value": 12 },
        { "name": "cron", "value": 4 }
      ]
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'entry-share',
    title: 'Request share by entry point',
    caption: 'Fig. 1. Two 100% bars compare the mix before and after the migration.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const proportionBarComponent: CatalogComponent = {
  name: 'proportion-bar',
  category: 'charts',
  summary: 'One 100% bar or a small set, labelled directly: a stand-in for pie charts.',
  inputKind: 'json',
  fields: describeSchemaFields(ProportionBarSchema),
  css: PROPORTION_BAR_CSS,
  clientBundle: 'proportion-bar.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
