import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { SchemaTableField, SchemaTableInput } from './schema-table-schema.js'

/**
 * Schema-table renderer. Flattens nested field lists into dotted paths
 * (limits.maxBytes) with depth indentation, and shows the example
 * column only when at least one field carries an example.
 * Pure builders, no DOM.
 */

export interface SchemaTableRenderOptions {
  readonly idPrefix: string
}

export interface FlatSchemaField {
  readonly path: string
  readonly depth: number
  readonly field: SchemaTableField
}

export function flattenSchemaFields(
  fields: ReadonlyArray<SchemaTableField>,
  prefix: string,
  depth: number
): ReadonlyArray<FlatSchemaField> {
  const out: Array<FlatSchemaField> = []

  for (const field of fields) {
    const path = prefix.length === 0 ? field.name : `${prefix}.${field.name}`
    out.push({ path, depth, field })

    if (field.fields !== undefined) {
      const nested = flattenSchemaFields(field.fields, path, depth + 1)

      for (const row of nested) {
        out.push(row)
      }
    }
  }

  return out
}

export function countSchemaFields(fields: ReadonlyArray<SchemaTableField>): number {
  let total = 0

  for (const field of fields) {
    total += 1

    if (field.fields !== undefined) {
      total += countSchemaFields(field.fields)
    }
  }

  return total
}

export function maxSchemaDepth(fields: ReadonlyArray<SchemaTableField>, depth: number): number {
  let deepest = depth

  for (const field of fields) {
    if (field.fields !== undefined) {
      const nested = maxSchemaDepth(field.fields, depth + 1)

      if (nested > deepest) {
        deepest = nested
      }
    }
  }

  return deepest
}

export function schemaHasExamples(fields: ReadonlyArray<SchemaTableField>): boolean {
  for (const field of fields) {
    if (field.example !== undefined) {
      return true
    }

    if (field.fields !== undefined && schemaHasExamples(field.fields)) {
      return true
    }
  }

  return false
}

function depthClass(depth: number): string {
  if (depth === 1) {
    return 'd1'
  }

  if (depth === 2) {
    return 'd2'
  }

  if (depth >= 3) {
    return 'd3'
  }

  return 'd0'
}

function renderRow(row: FlatSchemaField, showExample: boolean): string {
  const field = row.field
  const required = field.required ?? false

  const reqCell = required
    ? '<td class="req"><span class="req-y">required</span></td>'
    : '<td class="req"><span class="req-n">optional</span></td>'

  const fallback = field.default === undefined ? '' : escapeHtml(field.default)
  const example = field.example === undefined ? '' : `<code>${escapeHtml(field.example)}</code>`
  const description = field.description === undefined ? '' : escapeHtml(field.description)

  const exampleCell = showExample ? `<td class="ex">${example}</td>` : ''

  return `<tr><th scope="row" class="fld ${depthClass(row.depth)}">${escapeHtml(row.path)}</th><td class="typ">${escapeHtml(field.type)}</td>${reqCell}<td class="def">${fallback}</td><td class="desc">${description}</td>${exampleCell}</tr>`
}

export function renderSchemaTable(
  input: SchemaTableInput,
  options: SchemaTableRenderOptions
): string {
  const rows = flattenSchemaFields(input.fields, '', 0)
  const showExample = schemaHasExamples(input.fields)

  let head =
    '<thead><tr><th scope="col">field</th><th scope="col">type</th><th scope="col">required</th><th scope="col">default</th><th scope="col">description</th>'

  if (showExample) {
    head += '<th scope="col">example</th>'
  }

  head += '</tr></thead>'

  let body = '<tbody>'

  for (const row of rows) {
    body += renderRow(row, showExample)
  }

  body += '</tbody>'

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-schema" data-schema="schema-table" data-schema-id="${escapeAttr(options.idPrefix)}">${title}<div class="tw"><table>${head}${body}</table></div></div>`
}
