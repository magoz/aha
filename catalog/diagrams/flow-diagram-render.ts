import {
  directionFor,
  edgeOnPath,
  groupBounds,
  layoutGraph,
  nodeHighlighted,
  renderNodeBox,
  renderRoutedEdge
} from './layout.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import type { FlowDiagramInput } from './flow-diagram-schema.js'

/**
 * Flow-diagram renderer. The graph is layered automatically with the
 * shared layout engine; the browser client re-renders on resize so wide
 * containers read left-to-right and narrow ones top-to-bottom. Pure
 * builders shared by the Node build and the browser client.
 */

export const FLOW_DIAGRAM_WIDTH = 640

export interface FlowRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

export function renderFlowDiagram(input: FlowDiagramInput, options: FlowRenderOptions): string {
  const width = Math.max(300, options.width)
  const direction = directionFor(input.direction, width)
  const layout = layoutGraph(input.nodes, input.edges, { direction, span: width })
  const highlight: ReadonlyArray<string> = input.highlight ?? []

  let groups = ''

  for (const group of input.groups ?? []) {
    const members: Array<string> = []

    for (const node of input.nodes) {
      if (node.group === group.id) {
        members.push(node.id)
      }
    }

    const bounds = groupBounds(layout.boxes, members)

    if (bounds === null) {
      continue
    }

    groups += `<g class="grp"><rect x="${coord(bounds.x)}" y="${coord(bounds.y)}" width="${coord(bounds.w)}" height="${coord(bounds.h)}"/>`
    groups += `<text x="${coord(bounds.x + 10)}" y="${coord(bounds.y + 16)}">${escapeHtml(group.label)}</text></g>`
  }

  let edges = ''

  for (const edge of layout.edges) {
    edges += renderRoutedEdge(edge, edgeOnPath(edge.from, edge.to, highlight))
  }

  let nodes = ''

  for (const box of layout.boxes) {
    nodes += renderNodeBox(box, {
      highlight: nodeHighlighted(box.id, highlight),
      extraClass: '',
      inner: '',
      focusable: true
    })
  }

  const svg = `<svg viewBox="0 0 ${coord(layout.width)} ${coord(layout.height)}" role="presentation" data-direction="${direction}">${groups}${edges}${nodes}</svg>`

  const names: Array<string> = []

  for (const node of input.nodes) {
    names.push(node.label)
  }

  const aria =
    input.title === undefined
      ? `Flow diagram: ${names.join(', ')}`
      : `${input.title}: ${names.join(', ')}`

  const title = input.title === undefined ? '' : `<p class="dtitle">${escapeHtml(input.title)}</p>`

  return `<div class="aha-diagram aha-flow" data-diagram="flow-diagram" data-diagram-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}</div>`
}
