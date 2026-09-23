import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderProsCons } from './pros-cons-render.js'
import { ProsConsSchema } from './pros-cons-schema.js'
import { PROS_CONS_CSS } from './pros-cons-css.js'

/**
 * pros-cons component definition. Two weighted columns with an optional
 * verdict; weights stay short mono markers.
 */

const MAX_ITEMS = 20

const MAX_WEIGHT = 12

function checkSide(
  request: JsonRenderRequest,
  side: string,
  items: ReadonlyArray<{ readonly text: string; readonly weight?: string | undefined }>
): Effect.Effect<void, BlockDecodeError> {
  if (items.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'pros-cons',
        path: side,
        detail: `expected at least one ${side === 'pros' ? 'pro' : 'con'}`
      })
    )
  }

  if (items.length > MAX_ITEMS) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'pros-cons',
        path: side,
        detail: `expected at most ${String(MAX_ITEMS)} items`
      })
    )
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]

    if (item !== undefined && item.text.trim().length === 0) {
      return Effect.fail(
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'pros-cons',
          path: `${side}[${String(index)}].text`,
          detail: 'expected a non-empty line'
        })
      )
    }

    if (
      item !== undefined &&
      item.weight !== undefined &&
      (item.weight.trim().length === 0 || item.weight.trim().length > MAX_WEIGHT)
    ) {
      return Effect.fail(
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'pros-cons',
          path: `${side}[${String(index)}].weight`,
          detail: `expected a marker of 1 to ${String(MAX_WEIGHT)} characters, e.g. +2`
        })
      )
    }
  }

  return Effect.void
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(ProsConsSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'pros-cons',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) =>
      checkSide(request, 'pros', decoded.pros).pipe(
        Effect.flatMap(() => checkSide(request, 'cons', decoded.cons)),
        Effect.map(() => renderProsCons(decoded, { idPrefix: request.idPrefix }))
      )
    )
  )
}

const EXAMPLE_JSON = `{
  "title": "Tailnet box for the nightly eval",
  "pros": [
    { "text": "Reads private documents over the tailnet", "weight": "+2" },
    { "text": "Eleven minutes a run, inside the nightly window" },
    { "text": "Four cents a run, storage plus requests", "weight": "+1" }
  ],
  "cons": [
    { "text": "Needs wake timers and disk watch", "weight": "-1" },
    { "text": "One more box to patch" }
  ],
  "verdict": "Take the box; revisit if cron gains private reads."
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'eval-host-tradeoff',
    title: 'Tailnet box for the nightly eval',
    caption: 'Weighted pros and cons with a one-line verdict.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const prosConsComponent: CatalogComponent = {
  name: 'pros-cons',
  category: 'research',
  summary: 'Two weighted columns for the case for and against, with an optional verdict.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(ProsConsSchema),
  css: PROS_CONS_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
