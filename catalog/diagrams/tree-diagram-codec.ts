import type { JsonValue } from '../json-value.js'
import { isJsonArray, isJsonRecord, readTextField } from '../shared/guards.js'
import type { TreeDiagramInput } from './tree-diagram-schema.js'

/**
 * Defensive browser-side reader for validated tree-diagram JSON. The
 * build already decoded this block with Effect Schema; the client only
 * needs a total read so hand-edited markup cannot throw. Depth-capped
 * and null when the block is unusable.
 */

const MAX_CLIENT_DEPTH = 16

interface BuiltTree {
  label: string
  edge?: string
  children?: Array<BuiltTree>
}

export interface TreeDiagramBuilder {
  title?: string
  root: BuiltTree
}

function readTreeNode(value: JsonValue, depth: number): BuiltTree | null {
  if (!isJsonRecord(value) || depth > MAX_CLIENT_DEPTH) {
    return null
  }

  const label = readTextField(value, 'label')

  if (label === null) {
    return null
  }

  const out: BuiltTree = { label }
  const edge = readTextField(value, 'edge')

  if (edge !== null) {
    out.edge = edge
  }

  const raw = value['children']

  if (raw === undefined) {
    return out
  }

  if (!isJsonArray(raw)) {
    return null
  }

  const children: Array<BuiltTree> = []

  for (const entry of raw) {
    const child = readTreeNode(entry, depth + 1)

    if (child === null) {
      return null
    }

    children.push(child)
  }

  out.children = children

  return out
}

export function decodeTreeDiagramJson(record: {
  readonly [key: string]: JsonValue
}): TreeDiagramInput | null {
  const raw = record['root']

  if (raw === undefined) {
    return null
  }

  const root = readTreeNode(raw, 0)

  if (root === null) {
    return null
  }

  const out: TreeDiagramBuilder = { root }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  return out
}
