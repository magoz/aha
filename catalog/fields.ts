import { Predicate, Schema, SchemaAST } from 'effect'

import type { FieldDoc } from './component.js'

/**
 * Derive contributor-facing field docs from a component schema's
 * annotations. Components annotate each field with
 * `Schema.annotate({ description })`; this walker turns the AST into the
 * rows printed by `aha components <name>`.
 */

const MAX_DEPTH = 3

const hasDescription = Predicate.hasProperty('description')

function descriptionOf(ast: SchemaAST.AST): string {
  const annotations: unknown = ast.annotations

  if (!hasDescription(annotations)) {
    return ''
  }

  if (Predicate.isString(annotations.description)) {
    return annotations.description
  }

  return ''
}

function summarizeType(ast: SchemaAST.AST, depth: number): string {
  if (depth > MAX_DEPTH) {
    return '…'
  }

  if (SchemaAST.isString(ast)) {
    return 'string'
  }

  if (SchemaAST.isNumber(ast)) {
    return 'number'
  }

  if (SchemaAST.isBoolean(ast)) {
    return 'boolean'
  }

  if (SchemaAST.isNull(ast)) {
    return 'null'
  }

  if (SchemaAST.isUndefined(ast)) {
    return 'undefined'
  }

  if (SchemaAST.isLiteral(ast)) {
    return JSON.stringify(ast.literal) ?? 'literal'
  }

  if (SchemaAST.isArrays(ast)) {
    const parts: Array<string> = []

    for (const element of ast.elements) {
      parts.push(summarizeType(element, depth + 1))
    }

    for (const element of ast.rest) {
      parts.push(summarizeType(element, depth + 1))
    }

    return `array<${parts.join(' | ')}>`
  }

  if (SchemaAST.isUnion(ast)) {
    const parts: Array<string> = []

    for (const member of ast.types) {
      if (SchemaAST.isUndefined(member)) {
        continue
      }

      parts.push(summarizeType(member, depth + 1))
    }

    return parts.join(' | ')
  }

  if (SchemaAST.isObjects(ast)) {
    return 'object'
  }

  return ast._tag
}

function isOptionalField(ast: SchemaAST.AST): boolean {
  if (!SchemaAST.isUnion(ast)) {
    return false
  }

  for (const member of ast.types) {
    if (SchemaAST.isUndefined(member)) {
      return true
    }
  }

  return false
}

function collectFields(
  ast: SchemaAST.AST,
  prefix: string,
  depth: number,
  out: Array<FieldDoc>
): void {
  if (!SchemaAST.isObjects(ast)) {
    return
  }

  for (const signature of ast.propertySignatures) {
    const key = String(signature.name)
    const path = prefix.length === 0 ? key : `${prefix}.${key}`
    out.push({
      path,
      type: summarizeType(signature.type, depth),
      description: descriptionOf(signature.type),
      required: !isOptionalField(signature.type)
    })

    if (depth < 1 && SchemaAST.isObjects(signature.type)) {
      collectFields(signature.type, path, depth + 1, out)
    }
  }
}

export function describeSchemaFields(schema: Schema.Top): Array<FieldDoc> {
  const out: Array<FieldDoc> = []
  collectFields(schema.ast, '', 0, out)

  return out
}
