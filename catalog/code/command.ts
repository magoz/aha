import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderCommand } from './command-render.js'
import { CommandSchema } from './command-schema.js'
import { COMMAND_CSS } from './command-css.js'

/**
 * command component definition. A shell command with an optional
 * working directory, captured output in stdout and stderr lanes, and
 * an exit badge; the copy button degrades silently without clipboard
 * access.
 */

const MAX_COMMAND_CHARS = 2000

const MAX_CWD_CHARS = 200

const MAX_OUTPUT_LINES = 200

const MAX_OUTPUT_CHARS = 2000

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<string, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({
      blockIndex: request.blockIndex,
      component: 'command',
      path,
      detail
    })
  )
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(CommandSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'command',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.command.trim().length === 0 || decoded.command.length > MAX_COMMAND_CHARS) {
        return fail(request, 'command', 'expected the shell command as typed')
      }

      if (
        decoded.cwd !== undefined &&
        (decoded.cwd.trim().length === 0 || decoded.cwd.length > MAX_CWD_CHARS)
      ) {
        return fail(request, 'cwd', 'expected a short working directory')
      }

      if (decoded.output !== undefined) {
        if (decoded.output.length > MAX_OUTPUT_LINES) {
          return fail(request, 'output', `expected at most ${String(MAX_OUTPUT_LINES)} lines`)
        }

        for (let index = 0; index < decoded.output.length; index += 1) {
          const line = decoded.output[index]

          if (line === undefined) {
            continue
          }

          if (line.text.length > MAX_OUTPUT_CHARS) {
            return fail(
              request,
              `output[${String(index)}].text`,
              `expected at most ${String(MAX_OUTPUT_CHARS)} characters`
            )
          }
        }
      }

      if (
        decoded.exitCode !== undefined &&
        (!Number.isSafeInteger(decoded.exitCode) || decoded.exitCode < 0 || decoded.exitCode > 255)
      ) {
        return fail(request, 'exitCode', 'expected an exit code from 0 to 255')
      }

      return Effect.succeed(renderCommand(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "command": "pnpm verify",
  "cwd": "~/aha",
  "output": [
    { "text": "format: ok (214 files)" },
    { "text": "typecheck…" },
    { "text": "catalog/code/schema-table-render.ts(41,9): error TS2322: not assignable", "stderr": true },
    { "text": "typecheck failed: 1 error", "stderr": true }
  ],
  "exitCode": 1
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'failing-verify',
    title: 'Failing verify run',
    caption: 'Stdout and stderr lanes with a nonzero exit; the prompt glyph is unselectable.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const commandComponent: CatalogComponent = {
  name: 'command',
  category: 'code',
  summary: 'Shell command with working directory, output lanes and exit code.',
  inputKind: 'json',
  fields: describeSchemaFields(CommandSchema),
  css: COMMAND_CSS,
  clientBundle: 'command.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
