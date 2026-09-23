import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderSideBySide, splitPaneLines } from './side-by-side-render.js'
import { SideBySideSchema } from './side-by-side-schema.js'
import type { SidePane } from './side-by-side-schema.js'
import { SIDE_BY_SIDE_CSS } from './side-by-side-css.js'

/**
 * side-by-side component definition. Two labelled panes holding text
 * or code; code panes take a language and may mark changed lines.
 * Authors supply both sides; there is no diffing.
 */

const MAX_TEXT_CHARS = 20000

const MAX_TEXT_LINES = 400

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<string, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({
      blockIndex: request.blockIndex,
      component: 'side-by-side',
      path,
      detail
    })
  )
}

function checkPane(
  pane: SidePane,
  path: string,
  request: JsonRenderRequest
): Effect.Effect<string, BlockDecodeError> | null {
  if (pane.label.trim().length === 0 || pane.label.length > 120) {
    return fail(request, `${path}.label`, 'expected a short pane heading')
  }

  if (pane.text.trim().length === 0) {
    return fail(request, `${path}.text`, 'expected pane content')
  }

  if (pane.text.length > MAX_TEXT_CHARS) {
    return fail(request, `${path}.text`, `expected at most ${String(MAX_TEXT_CHARS)} characters`)
  }

  const lineCount = splitPaneLines(pane.text).length

  if (lineCount > MAX_TEXT_LINES) {
    return fail(request, `${path}.text`, `expected at most ${String(MAX_TEXT_LINES)} lines`)
  }

  if (
    pane.language !== undefined &&
    (pane.language.trim().length === 0 || pane.language.length > 40)
  ) {
    return fail(request, `${path}.language`, 'expected a short language label')
  }

  if (pane.changedLines !== undefined) {
    if (pane.language === undefined) {
      return fail(request, `${path}.changedLines`, 'marked lines need a language for line numbers')
    }

    for (let index = 0; index < pane.changedLines.length; index += 1) {
      const target = pane.changedLines[index]

      if (target === undefined || !Number.isSafeInteger(target) || target < 1) {
        return fail(request, `${path}.changedLines[${String(index)}]`, 'expected a line from 1 up')
      }

      if (target > lineCount) {
        return fail(
          request,
          `${path}.changedLines[${String(index)}]`,
          `expected a line up to ${String(lineCount)}`
        )
      }
    }
  }

  return null
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(SideBySideSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'side-by-side',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      const leftProblem = checkPane(decoded.left, 'left', request)

      if (leftProblem !== null) {
        return leftProblem
      }

      const rightProblem = checkPane(decoded.right, 'right', request)

      if (rightProblem !== null) {
        return rightProblem
      }

      return Effect.succeed(renderSideBySide(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "left": {
    "label": "Before",
    "language": "ts",
    "text": "if (isRedirect(status)) {\\n  return fail('redirect from origin')\\n}"
  },
  "right": {
    "label": "After",
    "language": "ts",
    "text": "if (isRedirect(status)) {\\n  throw new GatewayRedirectError({ status })\\n}",
    "changedLines": [2]
  }
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'redirect-error',
    title: 'Typed redirect error',
    caption: 'Before and after the gateway change; the changed line is marked.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const sideBySideComponent: CatalogComponent = {
  name: 'side-by-side',
  category: 'code',
  summary: 'Two labelled text or code panes, side by side when wide.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(SideBySideSchema),
  css: SIDE_BY_SIDE_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
