import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { countSchemaFields, maxSchemaDepth, renderSchemaTable } from './schema-table-render.js'
import { SchemaTableSchema } from './schema-table-schema.js'
import type { SchemaTableField } from './schema-table-schema.js'
import { SCHEMA_TABLE_CSS } from './schema-table-css.js'

/**
 * schema-table component definition. Field lists with nested objects
 * and arrays rendered under dotted paths, with an example column only
 * when at least one field carries an example.
 */

const MAX_TOP_FIELDS = 60

const MAX_TOTAL_FIELDS = 200

const MAX_DEPTH = 4

interface FieldProblem {
  readonly path: string
  readonly detail: string
}

function checkFieldText(
  value: string | undefined,
  fieldPath: string,
  field: string,
  problems: Array<FieldProblem>
): void {
  if (value !== undefined && (value.trim().length === 0 || value.length > 500)) {
    problems.push({ path: `${fieldPath}.${field}`, detail: `expected a short ${field}` })
  }
}

function checkFields(
  fields: ReadonlyArray<SchemaTableField>,
  basePath: string,
  depth: number,
  problems: Array<FieldProblem>
): void {
  if (depth > MAX_DEPTH) {
    problems.push({
      path: basePath,
      detail: `fields nest at most ${String(MAX_DEPTH)} levels deep`
    })

    return
  }

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]

    if (field === undefined) {
      continue
    }

    const fieldPath = `${basePath}[${String(index)}]`

    if (
      field.name.trim().length === 0 ||
      field.name.indexOf('.') !== -1 ||
      field.name.length > 80
    ) {
      problems.push({ path: `${fieldPath}.name`, detail: 'expected a name without dots' })
    }

    if (field.type.trim().length === 0 || field.type.length > 80) {
      problems.push({ path: `${fieldPath}.type`, detail: 'expected a short type label' })
    }

    checkFieldText(field.description, fieldPath, 'description', problems)
    checkFieldText(field.default, fieldPath, 'default', problems)
    checkFieldText(field.example, fieldPath, 'example', problems)

    if (field.fields !== undefined) {
      if (field.fields.length === 0) {
        problems.push({ path: `${fieldPath}.fields`, detail: 'expected at least one child field' })
      } else {
        checkFields(field.fields, `${fieldPath}.fields`, depth + 1, problems)
      }
    }
  }
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(SchemaTableSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'schema-table',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.fields.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'schema-table',
            path: 'fields',
            detail: 'expected at least one field'
          })
        )
      }

      if (decoded.fields.length > MAX_TOP_FIELDS) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'schema-table',
            path: 'fields',
            detail: `expected at most ${String(MAX_TOP_FIELDS)} top-level fields`
          })
        )
      }

      if (countSchemaFields(decoded.fields) > MAX_TOTAL_FIELDS) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'schema-table',
            path: 'fields',
            detail: `expected at most ${String(MAX_TOTAL_FIELDS)} fields in total`
          })
        )
      }

      if (maxSchemaDepth(decoded.fields, 0) > MAX_DEPTH) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'schema-table',
            path: 'fields',
            detail: `fields nest at most ${String(MAX_DEPTH)} levels deep`
          })
        )
      }

      const problems: Array<FieldProblem> = []
      checkFields(decoded.fields, 'fields', 0, problems)

      const first = problems[0]

      if (first !== undefined) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'schema-table',
            path: first.path,
            detail: first.detail
          })
        )
      }

      if (
        decoded.title !== undefined &&
        (decoded.title.trim().length === 0 || decoded.title.length > 200)
      ) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'schema-table',
            path: 'title',
            detail: 'expected a short title'
          })
        )
      }

      return Effect.succeed(renderSchemaTable(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "POST /api/ahas",
  "fields": [
    { "name": "id", "type": "string", "required": true, "description": "Document id, lowercase letters and dashes.", "example": "nightly-eval" },
    { "name": "html", "type": "string", "required": true, "description": "Self-contained page, at most 2 MiB." },
    { "name": "ifMatch", "type": "string", "description": "ETag guard for updates; mismatches fail with 412.", "example": "W/42" },
    { "name": "limits", "type": "object", "description": "Upload guardrails.", "fields": [
      { "name": "maxBytes", "type": "number", "default": "2097152", "description": "Largest accepted body in bytes.", "example": "2097152" },
      { "name": "allowPublic", "type": "boolean", "default": "false", "description": "Whether the upload may publish." }
    ] }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'upload-endpoint',
    title: 'Upload endpoint',
    caption: 'Four fields with one nested object; the example column appears on its own.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const schemaTableComponent: CatalogComponent = {
  name: 'schema-table',
  category: 'code',
  summary: 'Field table with dotted nested paths and an optional example column.',
  inputKind: 'json',
  fields: describeSchemaFields(SchemaTableSchema),
  css: SCHEMA_TABLE_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
