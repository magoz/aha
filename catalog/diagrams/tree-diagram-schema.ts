import { Schema } from 'effect'

/**
 * Wire schema for the tree-diagram component. A recursive hierarchy
 * rendered as a tidy top-down tree on wide containers and an indented
 * list on narrow ones. Field descriptions feed `aha components
 * tree-diagram`.
 */

export interface DiagramTreeNode {
  readonly label: string
  readonly edge?: string | undefined
  readonly children?: ReadonlyArray<DiagramTreeNode> | undefined
}

export const TreeNodeSchema: Schema.Codec<DiagramTreeNode> = Schema.Struct({
  label: Schema.String.annotate({ description: 'Node label drawn inside the box.' }),
  edge: Schema.optional(Schema.String).annotate({
    description: 'Label for the link from this node’s parent, e.g. yes or no.'
  }),
  children: Schema.optional(
    Schema.Array(Schema.suspend((): Schema.Codec<DiagramTreeNode> => TreeNodeSchema))
  ).annotate({ description: 'Child nodes, left to right; omit for a leaf.' })
})

export const TreeDiagramSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the diagram.'
  }),
  root: TreeNodeSchema.annotate({ description: 'Hierarchy root; branches nest inside.' })
})

export type TreeDiagramInput = (typeof TreeDiagramSchema)['Type']

const MAX_TREE_NODES = 150

/** Iterative node count so hostile nesting cannot overflow the stack. */
export function countTreeNodes(root: DiagramTreeNode): number {
  let total = 0
  const stack: Array<DiagramTreeNode> = [root]

  while (stack.length > 0) {
    const node = stack.pop()

    if (node === undefined) {
      continue
    }

    total += 1

    if (total > MAX_TREE_NODES) {
      return total
    }

    for (const child of node.children ?? []) {
      stack.push(child)
    }
  }

  return total
}

/** Iterative depth so hostile nesting cannot overflow the stack. */
export function treeDepth(root: DiagramTreeNode): number {
  let deepest = 0

  const stack: Array<{ readonly node: DiagramTreeNode; readonly depth: number }> = [
    { node: root, depth: 1 }
  ]

  while (stack.length > 0) {
    const frame = stack.pop()

    if (frame === undefined) {
      continue
    }

    if (frame.depth > deepest) {
      deepest = frame.depth
    }

    if (frame.depth > 12) {
      return deepest
    }

    for (const child of frame.node.children ?? []) {
      stack.push({ node: child, depth: frame.depth + 1 })
    }
  }

  return deepest
}

/** Every label must carry visible text. */
export function treeLabelsValid(root: DiagramTreeNode): boolean {
  const stack: Array<DiagramTreeNode> = [root]

  while (stack.length > 0) {
    const node = stack.pop()

    if (node === undefined) {
      continue
    }

    if (node.label.trim().length === 0) {
      return false
    }

    for (const child of node.children ?? []) {
      stack.push(child)
    }
  }

  return true
}
