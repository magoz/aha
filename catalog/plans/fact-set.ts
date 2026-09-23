import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { countFacts, renderFactSet } from './fact-set-render.js'
import { FactSetSchema } from './fact-set-schema.js'
import { FACT_SET_CSS } from './fact-set-css.js'

/**
 * fact-set component definition. A compact key-value spec sheet with
 * optional groups and muted mono units. Static markup reads directly.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(FactSetSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'fact-set',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      const items = decoded.items ?? []
      const groups = decoded.groups ?? []

      if (countFacts(items, groups) === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'fact-set',
            path: 'items',
            detail: 'expected at least one fact in items or groups'
          })
        )
      }

      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]

        if (group !== undefined && group.items.length === 0) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'fact-set',
              path: `groups[${String(index)}].items`,
              detail: 'expected at least one fact per group'
            })
          )
        }
      }

      return Effect.succeed(renderFactSet(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Field recorder",
  "groups": [
    {
      "name": "Audio",
      "items": [
        { "key": "sample rate", "value": "48", "unit": "kHz", "note": "24-bit, dual ADC." },
        { "key": "inputs", "value": "2", "unit": "XLR", "note": "Phantom power 48 V." },
        { "key": "noise floor", "value": "-127", "unit": "dBu" }
      ]
    },
    {
      "name": "Power",
      "items": [
        { "key": "cells", "value": "4", "unit": "AA" },
        { "key": "runtime", "value": "11", "unit": "h", "note": "Phantom on, screen dimmed." },
        { "key": "usb", "value": "C", "note": "Bus power while transferring." }
      ]
    },
    {
      "name": "Body",
      "items": [
        { "key": "weight", "value": "287", "unit": "g" },
        { "key": "storage", "value": "SDXC", "note": "Up to 1 TB cards." }
      ]
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'field-recorder',
    title: 'Field recorder',
    caption: 'Grouped facts with muted mono units and notes.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const factSetComponent: CatalogComponent = {
  name: 'fact-set',
  category: 'plans',
  summary: 'A compact key-value spec sheet with optional groups and muted units.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(FactSetSchema),
  css: FACT_SET_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
