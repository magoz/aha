import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderAnnotatedCode, splitCodeLines } from './annotated-code-render.js'
import { AnnotatedCodeSchema } from './annotated-code-schema.js'
import { ANNOTATED_CODE_CSS } from './annotated-code-css.js'

/**
 * annotated-code component definition. A code block with a language
 * label and optional filename, where numbered markers link lines to
 * notes; hovering or focusing either side highlights the other.
 */

const MAX_CODE_CHARS = 30000

const MAX_CODE_LINES = 300

const MAX_NOTES = 32

const MAX_NOTE_LINES = 8

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<string, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({
      blockIndex: request.blockIndex,
      component: 'annotated-code',
      path,
      detail
    })
  )
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(AnnotatedCodeSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'annotated-code',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.code.trim().length === 0) {
        return fail(request, 'code', 'expected code text')
      }

      if (decoded.code.length > MAX_CODE_CHARS) {
        return fail(request, 'code', `expected at most ${String(MAX_CODE_CHARS)} characters`)
      }

      const lineCount = splitCodeLines(decoded.code).length

      if (lineCount > MAX_CODE_LINES) {
        return fail(request, 'code', `expected at most ${String(MAX_CODE_LINES)} lines`)
      }

      if (decoded.notes.length === 0) {
        return fail(request, 'notes', 'expected at least one note')
      }

      if (decoded.notes.length > MAX_NOTES) {
        return fail(request, 'notes', `expected at most ${String(MAX_NOTES)} notes`)
      }

      for (let index = 0; index < decoded.notes.length; index += 1) {
        const note = decoded.notes[index]

        if (note === undefined) {
          continue
        }

        if (note.title.trim().length === 0) {
          return fail(request, `notes[${String(index)}].title`, 'expected a note heading')
        }

        if (note.text.trim().length === 0) {
          return fail(request, `notes[${String(index)}].text`, 'expected note text')
        }

        if (note.lines.length === 0 || note.lines.length > MAX_NOTE_LINES) {
          return fail(
            request,
            `notes[${String(index)}].lines`,
            `expected one to ${String(MAX_NOTE_LINES)} lines`
          )
        }

        for (let lineIndex = 0; lineIndex < note.lines.length; lineIndex += 1) {
          const target = note.lines[lineIndex]

          if (
            target === undefined ||
            !Number.isSafeInteger(target) ||
            target < 1 ||
            target > lineCount
          ) {
            return fail(
              request,
              `notes[${String(index)}].lines[${String(lineIndex)}]`,
              `expected a line from 1 to ${String(lineCount)}`
            )
          }
        }
      }

      if (
        decoded.language !== undefined &&
        (decoded.language.trim().length === 0 || decoded.language.length > 40)
      ) {
        return fail(request, 'language', 'expected a short language label')
      }

      if (
        decoded.filename !== undefined &&
        (decoded.filename.trim().length === 0 || decoded.filename.length > 200)
      ) {
        return fail(request, 'filename', 'expected a short file path')
      }

      return Effect.succeed(renderAnnotatedCode(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "language": "ts",
  "filename": "gateway/retry.ts",
  "code": "export async function withRetry<T>(task: () => Promise<T>): Promise<T> {\\n  let delayMs = 200\\n  for (let attempt = 1; attempt <= 4; attempt += 1) {\\n    try {\\n      return await task()\\n    } catch (error) {\\n      if (attempt === 4 || !isRetryable(error)) {\\n        throw error\\n      }\\n      await sleep(delayMs)\\n      delayMs = Math.min(delayMs * 2, 2000)\\n    }\\n  }\\n  throw new RetryExhaustedError()\\n}",
  "notes": [
    { "lines": [2, 10], "title": "Capped backoff", "text": "Starts at 200 ms, doubles per attempt, and never exceeds 2 s." },
    { "lines": [7], "title": "Retryable only", "text": "Client errors rethrow at once; only timeouts and 5xx wait." },
    { "lines": [13], "title": "Unreachable guard", "text": "The loop always returns or throws; this line exists so the types close." }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'retry-helper',
    title: 'Retry helper',
    caption: 'Three notes over a backoff loop; hovering a note highlights its lines.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const annotatedCodeComponent: CatalogComponent = {
  name: 'annotated-code',
  category: 'code',
  summary: 'Code with numbered line markers linked to notes below or beside it.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(AnnotatedCodeSchema),
  css: ANNOTATED_CODE_CSS,
  clientBundle: 'annotated-code.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
