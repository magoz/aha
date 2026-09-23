import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderStateDiagram } from './state-diagram-render.js'
import { StateDiagramSchema } from './state-diagram-schema.js'
import { STATE_DIAGRAM_CSS } from './state-diagram-css.js'

/**
 * state-diagram component definition. States and labelled transitions
 * with an initial state and final states, laid out like flow-diagram.
 */

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<never, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({
      blockIndex: request.blockIndex,
      component: 'state-diagram',
      path,
      detail
    })
  )
}

function checkRefs(
  request: JsonRenderRequest,
  decoded: (typeof StateDiagramSchema)['Type']
): Effect.Effect<void, BlockDecodeError> {
  const known = new Set<string>()

  for (const state of decoded.states) {
    if (known.has(state.id)) {
      return fail(request, 'states', `duplicate state id "${state.id}"`)
    }

    known.add(state.id)
  }

  if (!known.has(decoded.initial)) {
    return fail(request, 'initial', `unknown state "${decoded.initial}"`)
  }

  let transitionIndex = 0

  for (const transition of decoded.transitions) {
    if (!known.has(transition.from)) {
      return fail(
        request,
        'transitions',
        `transitions[${String(transitionIndex)}].from names unknown state "${transition.from}"`
      )
    }

    if (!known.has(transition.to)) {
      return fail(
        request,
        'transitions',
        `transitions[${String(transitionIndex)}].to names unknown state "${transition.to}"`
      )
    }

    transitionIndex += 1
  }

  for (const id of decoded.highlight ?? []) {
    if (!known.has(id)) {
      return fail(request, 'highlight', `unknown state "${id}"`)
    }
  }

  return Effect.void
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(StateDiagramSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'state-diagram',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.states.length === 0) {
        return fail(request, 'states', 'expected at least one state')
      }

      return checkRefs(request, decoded).pipe(
        Effect.map(() =>
          renderStateDiagram(decoded, { width: request.width, idPrefix: request.idPrefix })
        )
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Aha visibility lifecycle",
  "initial": "draft",
  "states": [
    { "id": "draft", "label": "Draft" },
    { "id": "private", "label": "Private" },
    { "id": "public", "label": "Public" },
    { "id": "archived", "label": "Archived", "final": true }
  ],
  "transitions": [
    { "from": "draft", "to": "private", "label": "upload" },
    { "from": "private", "to": "public", "label": "publish" },
    { "from": "public", "to": "private", "label": "unpublish" },
    { "from": "private", "to": "private", "label": "update" },
    { "from": "private", "to": "archived", "label": "retire" }
  ],
  "highlight": ["draft", "private", "public"]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'visibility-lifecycle',
    title: 'Aha visibility lifecycle',
    caption: 'Fig. 5. Visibility states with a self-update loop; the happy path is highlighted.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const stateDiagramComponent: CatalogComponent = {
  name: 'state-diagram',
  category: 'diagrams',
  summary: 'States and labelled transitions with an initial state and final states.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(StateDiagramSchema),
  css: STATE_DIAGRAM_CSS,
  clientBundle: 'state-diagram.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
