import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { parseTreePath, renderFileTree } from './file-tree-render.js'
import { FileTreeSchema } from './file-tree-schema.js'
import { FILE_TREE_CSS } from './file-tree-css.js'

/**
 * file-tree component definition. A flat path list grouped into
 * folders with a glyph-plus-word status column and a muted note
 * column; folders collapse when scripts run.
 */

const MAX_ENTRIES = 300

const MAX_NOTE_CHARS = 300

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<string, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({
      blockIndex: request.blockIndex,
      component: 'file-tree',
      path,
      detail
    })
  )
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(FileTreeSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'file-tree',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.entries.length === 0) {
        return fail(request, 'entries', 'expected at least one path')
      }

      if (decoded.entries.length > MAX_ENTRIES) {
        return fail(request, 'entries', `expected at most ${String(MAX_ENTRIES)} paths`)
      }

      for (let index = 0; index < decoded.entries.length; index += 1) {
        const entry = decoded.entries[index]

        if (entry === undefined) {
          continue
        }

        if (parseTreePath(entry.path) === null) {
          return fail(
            request,
            `entries[${String(index)}].path`,
            'expected a relative path without empty segments, .. or backslashes'
          )
        }

        if (entry.previous !== undefined) {
          if (entry.status !== 'renamed') {
            return fail(
              request,
              `entries[${String(index)}].previous`,
              'previous needs status renamed'
            )
          }

          if (parseTreePath(entry.previous) === null) {
            return fail(
              request,
              `entries[${String(index)}].previous`,
              'expected a relative path without empty segments, .. or backslashes'
            )
          }
        }

        if (
          entry.note !== undefined &&
          (entry.note.trim().length === 0 || entry.note.length > MAX_NOTE_CHARS)
        ) {
          return fail(request, `entries[${String(index)}].note`, 'expected a short note')
        }
      }

      if (
        decoded.title !== undefined &&
        (decoded.title.trim().length === 0 || decoded.title.length > 200)
      ) {
        return fail(request, 'title', 'expected a short title')
      }

      return Effect.succeed(renderFileTree(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Split the gateway into three files",
  "entries": [
    { "path": "gateway/policy.ts", "status": "changed", "note": "adds the redirect refusal" },
    { "path": "gateway/forward.ts", "status": "added", "note": "fixed upstream plus read paths" },
    { "path": "gateway/server.ts", "status": "renamed", "previous": "gateway/gateway.ts", "note": "name matches the binary" },
    { "path": "gateway/legacy.ts", "status": "removed", "note": "folded into forward.ts" },
    { "path": "tests/gateway-policy.test.ts", "note": "redirect and header cases" }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'gateway-split',
    title: 'Gateway split',
    caption: 'Five paths across two folders; every status shows a glyph plus a word.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const fileTreeComponent: CatalogComponent = {
  name: 'file-tree',
  category: 'code',
  summary: 'Flat path list grouped into a collapsible tree with status markers.',
  inputKind: 'json',
  fields: describeSchemaFields(FileTreeSchema),
  css: FILE_TREE_CSS,
  clientBundle: 'file-tree.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
