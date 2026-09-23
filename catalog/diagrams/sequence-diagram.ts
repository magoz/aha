import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderSequenceDiagram } from './sequence-diagram-render.js'
import { SequenceDiagramSchema } from './sequence-diagram-schema.js'
import { SEQUENCE_DIAGRAM_CSS } from './sequence-diagram-css.js'

/**
 * sequence-diagram component definition. Actors as lifelines with
 * ordered sync, async and return messages, optional notes and one
 * highlighted message.
 */

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<never, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({
      blockIndex: request.blockIndex,
      component: 'sequence-diagram',
      path,
      detail
    })
  )
}

function checkRefs(
  request: JsonRenderRequest,
  decoded: (typeof SequenceDiagramSchema)['Type']
): Effect.Effect<void, BlockDecodeError> {
  const known = new Set<string>()

  for (const actor of decoded.actors) {
    if (known.has(actor.id)) {
      return fail(request, 'actors', `duplicate actor id "${actor.id}"`)
    }

    known.add(actor.id)
  }

  let messageIndex = 0

  for (const message of decoded.messages) {
    if (!known.has(message.from)) {
      return fail(
        request,
        'messages',
        `messages[${String(messageIndex)}].from names unknown actor "${message.from}"`
      )
    }

    if (!known.has(message.to)) {
      return fail(
        request,
        'messages',
        `messages[${String(messageIndex)}].to names unknown actor "${message.to}"`
      )
    }

    messageIndex += 1
  }

  let noteIndex = 0

  for (const note of decoded.notes ?? []) {
    if (note.actor !== undefined && !known.has(note.actor)) {
      return fail(
        request,
        'notes',
        `notes[${String(noteIndex)}].actor names unknown actor "${note.actor}"`
      )
    }

    const after = note.after ?? decoded.messages.length

    if (!Number.isInteger(after) || after < 0 || after > decoded.messages.length) {
      return fail(
        request,
        'notes',
        `notes[${String(noteIndex)}].after must be 0..${String(decoded.messages.length)}`
      )
    }

    noteIndex += 1
  }

  return Effect.void
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(SequenceDiagramSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'sequence-diagram',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.actors.length < 2) {
        return fail(request, 'actors', 'expected at least two actors')
      }

      if (decoded.messages.length === 0) {
        return fail(request, 'messages', 'expected at least one message')
      }

      return checkRefs(request, decoded).pipe(
        Effect.map(() =>
          renderSequenceDiagram(decoded, { width: request.width, idPrefix: request.idPrefix })
        )
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Upload and publish",
  "actors": [
    { "id": "cli", "label": "CLI" },
    { "id": "api", "label": "Vercel API" },
    { "id": "r2", "label": "R2 store" }
  ],
  "messages": [
    { "from": "cli", "to": "api", "label": "upload page.html", "kind": "sync" },
    { "from": "api", "to": "r2", "label": "put aha/<id>.html", "kind": "sync" },
    { "from": "r2", "to": "api", "label": "etag", "kind": "return" },
    { "from": "cli", "to": "api", "label": "publish <id>", "kind": "sync", "highlight": true },
    { "from": "api", "to": "r2", "label": "put public/<id>", "kind": "sync" },
    { "from": "r2", "to": "api", "label": "ok", "kind": "return" },
    { "from": "api", "to": "cli", "label": "public URL", "kind": "async" }
  ],
  "notes": [
    { "text": "uploads stay private until publish", "after": 3 }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'upload-and-publish',
    title: 'Upload and publish',
    caption: 'Fig. 2. Uploading a page then publishing it; the publish call is highlighted.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const sequenceDiagramComponent: CatalogComponent = {
  name: 'sequence-diagram',
  category: 'diagrams',
  summary: 'Actors as lifelines with ordered sync, async and return messages plus notes.',
  inputKind: 'json',
  fields: describeSchemaFields(SequenceDiagramSchema),
  css: SEQUENCE_DIAGRAM_CSS,
  clientBundle: 'sequence-diagram.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
