import { measureLabel } from './layout.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import type { DiagramTreeNode, TreeDiagramInput } from './tree-diagram-schema.js'

/**
 * Tree-diagram renderer. Wide containers get a tidy top-down tree with
 * orthogonal connectors; narrow ones get an indented list with stub
 * connectors so text never shrinks. Every subtree is wrapped for the
 * client to collapse; without scripts everything stays expanded. Pure
 * builders shared by the Node build and the browser client.
 */

export const TREE_DIAGRAM_WIDTH = 640

const PAD = 10

const INDENT = 24

const TOP = 10

const GAP_Y = 56

const ARROW_LEN = 9

export interface TreeRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

interface FlatNode {
  readonly path: string
  readonly label: string
  readonly edge: string | null
  readonly lines: ReadonlyArray<string>
  readonly w: number
  readonly h: number
  readonly depth: number
  readonly parent: string | null
  readonly children: Array<string>
}

interface Geom {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly cx: number
  readonly cy: number
}

function flatten(root: DiagramTreeNode): Array<FlatNode> {
  const out: Array<FlatNode> = []
  const byPath = new Map<string, FlatNode>()

  const stack: Array<{
    readonly node: DiagramTreeNode
    readonly path: string
    readonly depth: number
    readonly parent: string | null
  }> = [{ node: root, path: '0', depth: 0, parent: null }]

  while (stack.length > 0) {
    const frame = stack.pop()

    if (frame === undefined) {
      continue
    }

    const measured = measureLabel(frame.node.label)

    const flat: FlatNode = {
      path: frame.path,
      label: frame.node.label,
      edge: frame.node.edge ?? null,
      lines: measured.lines,
      w: measured.w,
      h: measured.h,
      depth: frame.depth,
      parent: frame.parent,
      children: []
    }

    out.push(flat)
    byPath.set(frame.path, flat)

    if (frame.parent !== null) {
      const parent = byPath.get(frame.parent)

      if (parent !== undefined) {
        parent.children.push(frame.path)
      }
    }

    const kids = frame.node.children ?? []

    for (let index = kids.length - 1; index >= 0; index -= 1) {
      const child = kids[index]

      if (child !== undefined) {
        stack.push({
          node: child,
          path: `${frame.path}-${String(index)}`,
          depth: frame.depth + 1,
          parent: frame.path
        })
      }
    }
  }

  return out
}

function nodeBox(node: FlatNode, geom: Geom): string {
  const hasKids = node.children.length > 0
  const kids = hasKids ? ` data-kids="${escapeAttr(node.path)}" aria-expanded="true"` : ''
  const textX = hasKids ? geom.x + 20 + (geom.w - 20) / 2 : geom.x + geom.w / 2
  let text = ''

  if (node.lines.length === 1) {
    text = `<text x="${coord(textX)}" y="${coord(geom.y + geom.h / 2 + 4)}" text-anchor="middle" class="ntext">${escapeHtml(node.lines[0] ?? '')}</text>`
  } else {
    text = `<text x="${coord(textX)}" y="${coord(geom.y + geom.h / 2 - 3)}" text-anchor="middle" class="ntext">${escapeHtml(node.lines[0] ?? '')}</text>`
    text += `<text x="${coord(textX)}" y="${coord(geom.y + geom.h / 2 + 10)}" text-anchor="middle" class="ntext">${escapeHtml(node.lines[1] ?? '')}</text>`
  }

  const toggle = hasKids
    ? `<rect x="${coord(geom.x + 5)}" y="${coord(geom.cy - 7)}" width="14" height="14" class="tgl"/><text x="${coord(geom.x + 12)}" y="${coord(geom.cy + 4)}" text-anchor="middle" class="tglx">−</text>`
    : ''

  return `<g class="node tnode" data-node="${escapeAttr(node.path)}"${kids} tabindex="0" role="button" aria-label="${escapeAttr(node.label)}"><rect x="${coord(geom.x)}" y="${coord(geom.y)}" width="${coord(geom.w)}" height="${coord(geom.h)}" class="nrect"/>${toggle}${text}</g>`
}

function arrowDown(tipX: number, tipY: number): string {
  return `<polygon points="${coord(tipX)},${coord(tipY)} ${coord(tipX - 4)},${coord(tipY - ARROW_LEN)} ${coord(tipX + 4)},${coord(tipY - ARROW_LEN)}"/>`
}

function arrowRight(tipX: number, tipY: number): string {
  return `<polygon points="${coord(tipX)},${coord(tipY)} ${coord(tipX - ARROW_LEN)},${coord(tipY - 4)} ${coord(tipX - ARROW_LEN)},${coord(tipY + 4)}"/>`
}

function emitWide(node: FlatNode, byPath: Map<string, FlatNode>, geom: Map<string, Geom>): string {
  const self = geom.get(node.path)

  if (self === undefined) {
    return ''
  }

  let out = nodeBox(node, self)

  if (node.children.length === 0) {
    return out
  }

  let kids = ''

  for (const childPath of node.children) {
    const child = byPath.get(childPath)
    const target = geom.get(childPath)

    if (child === undefined || target === undefined) {
      continue
    }

    const midY = (self.y + self.h + target.y) / 2
    const d = `M${coord(self.cx)} ${coord(self.y + self.h)} V${coord(midY)} H${coord(target.cx)} V${coord(target.y - ARROW_LEN)}`
    const near = Math.abs(self.cx - target.cx) < 4

    const label =
      child.edge === null
        ? ''
        : near
          ? `<text x="${coord(self.cx + 6)}" y="${coord(midY - 6)}" text-anchor="start" class="elbl">${escapeHtml(child.edge)}</text>`
          : `<text x="${coord((self.cx + target.cx) / 2)}" y="${coord(midY - 6)}" text-anchor="middle" class="elbl">${escapeHtml(child.edge)}</text>`

    kids += `<g class="edge conn" data-edge="" data-from="${escapeAttr(node.path)}" data-to="${escapeAttr(child.path)}"><path d="${d}"/>${arrowDown(target.cx, target.y)}${label}</g>`
    kids += emitWide(child, byPath, geom)
  }

  return `${out}<g class="tsub" data-sub="${escapeAttr(node.path)}">${kids}</g>`
}

function emitRow(node: FlatNode, byPath: Map<string, FlatNode>, geom: Map<string, Geom>): string {
  const self = geom.get(node.path)

  if (self === undefined) {
    return ''
  }

  let out = ''

  if (node.parent !== null) {
    const parent = byPath.get(node.parent)
    const parentGeom = geom.get(node.parent)

    if (parent !== undefined && parentGeom !== undefined) {
      const spineX = Math.min(parentGeom.x + 12, self.x - 28)
      const d = `M${coord(spineX)} ${coord(parentGeom.cy)} V${coord(self.cy)} H${coord(self.x - ARROW_LEN)}`

      const label =
        node.edge === null
          ? ''
          : `<text x="${coord(self.x)}" y="${coord(self.y - 3)}" text-anchor="start" class="elbl">${escapeHtml(node.edge)}</text>`

      out += `<g class="edge conn" data-edge="" data-from="${escapeAttr(node.parent)}" data-to="${escapeAttr(node.path)}"><path d="${d}"/>${arrowRight(self.x, self.cy)}${label}</g>`
    }
  }

  out += nodeBox(node, self)

  if (node.children.length === 0) {
    return out
  }

  let kids = ''

  for (const childPath of node.children) {
    const child = byPath.get(childPath)

    if (child !== undefined) {
      kids += emitRow(child, byPath, geom)
    }
  }

  return `${out}<g class="tsub" data-sub="${escapeAttr(node.path)}">${kids}</g>`
}

export function renderTreeDiagram(input: TreeDiagramInput, options: TreeRenderOptions): string {
  const span = Math.max(300, options.width)
  const nodes = flatten(input.root)
  const byPath = new Map<string, FlatNode>()

  for (const node of nodes) {
    byPath.set(node.path, node)
  }

  const narrow = span < 560
  const geom = new Map<string, Geom>()
  let width = span
  let height = TOP + PAD

  if (!narrow) {
    let maxW = 0

    for (const node of nodes) {
      if (node.w > maxW) {
        maxW = node.w
      }
    }

    const pitch = maxW + 36
    const cx = new Map<string, number>()
    let leaves = 0

    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index]

      if (node === undefined) {
        continue
      }

      if (node.children.length === 0) {
        cx.set(node.path, leaves * pitch + pitch / 2)
        leaves += 1
        continue
      }

      const first = cx.get(node.children[0] ?? '')
      const last = cx.get(node.children[node.children.length - 1] ?? '')

      if (first !== undefined && last !== undefined) {
        cx.set(node.path, (first + last) / 2)
      }
    }

    const naturalW = leaves * pitch + PAD * 2

    if (naturalW > width) {
      width = naturalW
    }

    let maxDepth = 0

    for (const node of nodes) {
      if (node.depth > maxDepth) {
        maxDepth = node.depth
      }
    }

    const depthY: Array<number> = []
    let cursor = TOP

    for (let depth = 0; depth <= maxDepth; depth += 1) {
      let tallest = 0

      for (const node of nodes) {
        if (node.depth === depth && node.h > tallest) {
          tallest = node.h
        }
      }

      depthY.push(cursor)
      cursor += tallest + GAP_Y
    }

    height = cursor - GAP_Y + PAD

    for (const node of nodes) {
      const x = PAD + (cx.get(node.path) ?? pitch / 2) - node.w / 2
      const y = depthY[node.depth] ?? TOP
      geom.set(node.path, { x, y, w: node.w, h: node.h, cx: x + node.w / 2, cy: y + node.h / 2 })
    }

    const root = nodes[0]

    const svg =
      root === undefined
        ? ''
        : `<svg viewBox="0 0 ${coord(width)} ${coord(height)}" role="presentation" data-layout="wide">${emitWide(root, byPath, geom)}</svg>`

    return treeFrame(input, options.idPrefix, svg)
  }

  let cursor = TOP

  for (const node of nodes) {
    const cap = span - PAD * 2 - 110
    const off = Math.min(node.depth * INDENT, Math.max(0, cap))
    const w = span - PAD * 2 - off
    const y = cursor + 7
    geom.set(node.path, { x: PAD + off, y, w, h: node.h, cx: 0, cy: y + node.h / 2 })
    const self = geom.get(node.path)

    if (self !== undefined) {
      geom.set(node.path, { ...self, cx: self.x + self.w / 2 })
    }

    cursor += node.h + 14
  }

  height = cursor - 14 + PAD
  const root = nodes[0]

  const svg =
    root === undefined
      ? ''
      : `<svg viewBox="0 0 ${coord(width)} ${coord(height)}" role="presentation" data-layout="narrow">${emitRow(root, byPath, geom)}</svg>`

  return treeFrame(input, options.idPrefix, svg)
}

function treeFrame(input: TreeDiagramInput, idPrefix: string, svg: string): string {
  const names: Array<string> = []
  const stack: Array<DiagramTreeNode> = [input.root]

  while (stack.length > 0) {
    const node = stack.pop()

    if (node === undefined) {
      continue
    }

    names.push(node.label)

    for (const child of node.children ?? []) {
      stack.push(child)
    }
  }

  const aria =
    input.title === undefined
      ? `Tree diagram: ${names.join(', ')}`
      : `${input.title}: ${names.join(', ')}`

  const title = input.title === undefined ? '' : `<p class="dtitle">${escapeHtml(input.title)}</p>`

  return `<div class="aha-diagram aha-tree" data-diagram="tree-diagram" data-diagram-id="${escapeAttr(idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}</div>`
}
