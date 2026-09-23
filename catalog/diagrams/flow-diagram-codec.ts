import type { JsonValue } from '../json-value.js'
import { isJsonRecord, isJsonText, readArrayField, readTextField } from '../shared/guards.js'
import type { FlowDiagramInput } from './flow-diagram-schema.js'

/**
 * Defensive browser-side reader for validated flow-diagram JSON. The build
 * already decoded this block with Effect Schema; the client only needs a
 * total read so hand-edited markup cannot throw. Returns null when the
 * block is unusable, in which case the client leaves static markup alone.
 */

interface BuiltNode {
  id: string
  label: string
  group?: string
}

interface BuiltEdge {
  from: string
  to: string
  label?: string
}

interface BuiltGroup {
  id: string
  label: string
}

export interface FlowDiagramBuilder {
  title?: string
  direction?: 'auto' | 'lr' | 'tb'
  groups?: Array<BuiltGroup>
  readonly nodes: Array<BuiltNode>
  readonly edges: Array<BuiltEdge>
  highlight?: Array<string>
}

function readNode(entry: JsonValue): BuiltNode | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const id = readTextField(entry, 'id')
  const label = readTextField(entry, 'label')

  if (id === null || label === null) {
    return null
  }

  const group = readTextField(entry, 'group')
  const out: BuiltNode = { id, label }

  if (group !== null) {
    out.group = group
  }

  return out
}

function readEdge(entry: JsonValue): BuiltEdge | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const from = readTextField(entry, 'from')
  const to = readTextField(entry, 'to')

  if (from === null || to === null) {
    return null
  }

  const label = readTextField(entry, 'label')
  const out: BuiltEdge = { from, to }

  if (label !== null) {
    out.label = label
  }

  return out
}

function readGroup(entry: JsonValue): BuiltGroup | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const id = readTextField(entry, 'id')
  const label = readTextField(entry, 'label')

  if (id === null || label === null) {
    return null
  }

  return { id, label }
}

function readDirection(raw: JsonValue | undefined): 'auto' | 'lr' | 'tb' | undefined {
  if (raw === 'lr' || raw === 'tb' || raw === 'auto') {
    return raw
  }

  return undefined
}

function readIdList(raw: ReadonlyArray<JsonValue>): Array<string> {
  const out: Array<string> = []

  for (const entry of raw) {
    if (isJsonText(entry)) {
      out.push(entry)
    }
  }

  return out
}

export function decodeFlowDiagramJson(record: {
  readonly [key: string]: JsonValue
}): FlowDiagramInput | null {
  const nodesRaw = readArrayField(record, 'nodes')
  const edgesRaw = readArrayField(record, 'edges')

  if (nodesRaw === null || edgesRaw === null || nodesRaw.length === 0) {
    return null
  }

  const nodes: Array<BuiltNode> = []

  for (const entry of nodesRaw) {
    const node = readNode(entry)

    if (node !== null) {
      nodes.push(node)
    }
  }

  if (nodes.length === 0) {
    return null
  }

  const edges: Array<BuiltEdge> = []

  for (const entry of edgesRaw) {
    const edge = readEdge(entry)

    if (edge !== null) {
      edges.push(edge)
    }
  }

  const out: FlowDiagramBuilder = { nodes, edges }

  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  const direction = readDirection(record['direction'])

  if (direction !== undefined) {
    out.direction = direction
  }

  const groupsRaw = readArrayField(record, 'groups')

  if (groupsRaw !== null) {
    const groups: Array<BuiltGroup> = []

    for (const entry of groupsRaw) {
      const group = readGroup(entry)

      if (group !== null) {
        groups.push(group)
      }
    }

    out.groups = groups
  }

  const highlightRaw = readArrayField(record, 'highlight')

  if (highlightRaw !== null) {
    out.highlight = readIdList(highlightRaw)
  }

  return out
}
