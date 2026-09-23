import { Predicate, Schema, SchemaAST } from 'effect'

import type { FieldDoc } from './component.js'

/**
 * Derive contributor-facing field docs from a component schema's
 * annotations. Components annotate each field with
 * `Schema.annotate({ description })`; this walker turns the AST into the
 * rows printed by `aha components <name>`.
 *
 * The walker recurses into nested structs and arrays of structs, so
 * `series` also documents `series[].name` and `series[].values[].x`.
 * Recursive schemas (Schema.suspend) print one row naming the earlier
 * path, e.g. `fields[].fields (recursive: same as fields[])`, instead
 * of looping. MAX_DEPTH keeps the output compact.
 */

const MAX_DEPTH = 4

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

  if (SchemaAST.isSuspend(ast)) {
    return summarizeType(ast.thunk(), depth + 1)
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

/** Resolve transparent suspend nodes (Schema.suspend); the guard stops a
 * pathological self-thunk from looping forever. */
function resolveSuspend(ast: SchemaAST.AST): SchemaAST.AST {
  let node = ast
  let guard = 0

  while (SchemaAST.isSuspend(node) && guard < 32) {
    node = node.thunk()
    guard += 1
  }

  return node
}

interface ExpansionTarget {
  readonly struct: SchemaAST.Objects
  readonly suffix: string
}

/** Find the struct behind a field type, looking through optional unions
 * and arrays (collecting `[]` per array level). A union of several
 * shapes (e.g. a oneOf cell) has no single dotted path, so it stays
 * folded into its summary instead of expanding. */
function expansionTarget(fieldType: SchemaAST.AST): ExpansionTarget | null {
  let node = fieldType
  let suffix = ''
  let guard = 0

  while (guard < 32) {
    guard += 1
    node = resolveSuspend(node)

    if (SchemaAST.isUnion(node)) {
      let single: SchemaAST.AST | null = null
      let count = 0

      for (const member of node.types) {
        if (SchemaAST.isUndefined(member)) {
          continue
        }

        count += 1
        single = member
      }

      if (count !== 1 || single === null) {
        return null
      }

      node = single
      continue
    }

    if (SchemaAST.isArrays(node)) {
      let found: ExpansionTarget | null = null

      for (const element of node.elements) {
        const inner = expansionTarget(element)

        if (inner !== null) {
          found = inner
          break
        }
      }

      if (found === null) {
        for (const rest of node.rest) {
          const inner = expansionTarget(rest)

          if (inner !== null) {
            found = inner
            break
          }
        }
      }

      if (found === null) {
        return null
      }

      return { struct: found.struct, suffix: `${suffix}[]${found.suffix}` }
    }

    if (SchemaAST.isObjects(node)) {
      return { struct: node, suffix }
    }

    return null
  }

  return null
}

interface AncestorFrame {
  readonly struct: SchemaAST.Objects
  readonly path: string
}

function collectFields(
  ast: SchemaAST.AST,
  prefix: string,
  depth: number,
  ancestors: Array<AncestorFrame>,
  out: Array<FieldDoc>
): void {
  const node = resolveSuspend(ast)

  if (!SchemaAST.isObjects(node)) {
    return
  }

  for (const signature of node.propertySignatures) {
    const key = String(signature.name)
    const path = prefix.length === 0 ? key : `${prefix}.${key}`

    const row: FieldDoc = {
      path,
      type: summarizeType(signature.type, depth),
      description: descriptionOf(signature.type),
      required: !isOptionalField(signature.type)
    }

    if (depth >= MAX_DEPTH) {
      out.push(row)
      continue
    }

    const target = expansionTarget(signature.type)

    if (target === null) {
      out.push(row)
      continue
    }

    const nestedPath = `${path}${target.suffix}`
    let seen: AncestorFrame | null = null

    for (const frame of ancestors) {
      if (frame.struct === target.struct) {
        seen = frame
        break
      }
    }

    if (seen !== null) {
      out.push({
        path,
        type: `recursive: same as ${seen.path}`,
        description: row.description,
        required: row.required
      })
      continue
    }

    out.push(row)
    ancestors.push({ struct: target.struct, path: nestedPath })
    collectFields(target.struct, nestedPath, depth + 1, ancestors, out)
    ancestors.pop()
  }
}

export function describeSchemaFields(schema: Schema.Top): Array<FieldDoc> {
  const out: Array<FieldDoc> = []
  collectFields(schema.ast, '', 0, [], out)

  return out
}
