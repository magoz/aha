import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderStatusList } from './status-list-render.js'
import { StatusListSchema } from './status-list-schema.js'
import { STATUS_LIST_CSS } from './status-list-css.js'

/**
 * status-list component definition. Tasks with a glyph-plus-word state,
 * optional owner, due date and note, flat or grouped, with a counts
 * summary. Static markup reads without scripts.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(StatusListSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'status-list',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      const flat = decoded.tasks ?? []
      const groups = decoded.groups ?? []
      let total = flat.length

      for (const group of groups) {
        total += group.tasks.length
      }

      if (total === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'status-list',
            path: 'tasks',
            detail: 'expected at least one task in tasks or groups'
          })
        )
      }

      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]

        if (group !== undefined && group.tasks.length === 0) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'status-list',
              path: `groups[${String(index)}].tasks`,
              detail: 'expected at least one task per group'
            })
          )
        }
      }

      return Effect.succeed(renderStatusList(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Launch week punch list",
  "groups": [
    {
      "name": "Ship blockers",
      "tasks": [
        { "title": "Freeze the eval schema", "status": "done", "owner": "Iris" },
        { "title": "Point the gateway at the fixed upstream", "status": "doing", "owner": "Iris", "due": "2026-10-09", "note": "Waiting on the tailnet DNS cutover." },
        { "title": "Rotate the leaked preview token", "status": "blocked", "owner": "Theo", "due": "2026-10-08", "note": "Blocked on the provider console access grant." }
      ]
    },
    {
      "name": "After launch",
      "tasks": [
        { "title": "Write the one-line changelog entry", "status": "todo", "owner": "Iris" },
        { "title": "Archive the staging bucket", "status": "todo", "due": "2026-10-16" }
      ]
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'launch-punch-list',
    title: 'Launch week punch list',
    caption: 'Grouped tasks with owners, due dates and a counts summary.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const statusListComponent: CatalogComponent = {
  name: 'status-list',
  category: 'plans',
  summary: 'Tasks with a glyph-plus-word state, owner, due date and a counts summary.',
  inputKind: 'json',
  fields: describeSchemaFields(StatusListSchema),
  css: STATUS_LIST_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
