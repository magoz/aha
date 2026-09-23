import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderScalableList } from './scalable-list-render.js'
import { ScalableListSchema } from './scalable-list-schema.js'
import { SCALABLE_LIST_CSS } from './scalable-list-css.js'

/**
 * scalable-list component definition. Quantities for a base yield with a
 * small control that rescales every number live; without scripts the
 * base yield reads directly.
 */

const KNOWN_UNITS: ReadonlyArray<string> = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'pcs', 'eggs']

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(ScalableListSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'scalable-list',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) =>
      Effect.gen(function* () {
        const fail = (path: string, detail: string): Effect.Effect<never, BlockDecodeError> =>
          Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'scalable-list',
              path,
              detail
            })
          )

        if (!Number.isFinite(decoded.serves) || decoded.serves <= 0) {
          return yield* fail('serves', 'expected serves above 0')
        }

        if (decoded.items.length === 0) {
          return yield* fail('items', 'expected at least one quantity')
        }

        if (decoded.presets !== undefined) {
          for (let index = 0; index < decoded.presets.length; index += 1) {
            const preset = decoded.presets[index]

            if (preset === undefined || !Number.isFinite(preset) || preset <= 0) {
              return yield* fail(`presets[${String(index)}]`, 'expected preset yields above 0')
            }
          }
        }

        for (let index = 0; index < decoded.items.length; index += 1) {
          const item = decoded.items[index]

          if (item === undefined) {
            continue
          }

          if (item.qty !== null && (!Number.isFinite(item.qty) || item.qty < 0)) {
            return yield* fail(`items[${String(index)}].qty`, 'expected qty of 0 or more')
          }

          if (item.unit !== undefined && !KNOWN_UNITS.includes(item.unit)) {
            return yield* fail(
              `items[${String(index)}].unit`,
              `expected one of ${KNOWN_UNITS.join(', ')}, got ${item.unit}`
            )
          }
        }

        return renderScalableList(decoded, { idPrefix: request.idPrefix })
      })
    )
  )
}

const EXAMPLE_JSON = `{
  "title": "Tortilla de patatas",
  "serves": 4,
  "servesLabel": "servings",
  "presets": [2, 4, 8],
  "items": [
    { "name": "waxy potatoes", "qty": 800, "unit": "g", "note": "thinly sliced" },
    { "name": "eggs", "qty": 6, "unit": "eggs" },
    { "name": "olive oil", "qty": 100, "unit": "ml" },
    { "name": "yellow onion", "qty": 1, "unit": "pcs", "whole": true, "note": "thinly sliced" },
    { "name": "salt", "qty": null, "note": "flaky, to finish" }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'tortilla-de-patatas',
    title: 'Tortilla de patatas',
    caption: 'Five quantities for 4 servings; the control rescales them live.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const scalableListComponent: CatalogComponent = {
  name: 'scalable-list',
  category: 'plans',
  summary: 'Quantities for a base yield with a control that rescales them live.',
  inputKind: 'json',
  fields: describeSchemaFields(ScalableListSchema),
  css: SCALABLE_LIST_CSS,
  clientBundle: 'scalable-list.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
