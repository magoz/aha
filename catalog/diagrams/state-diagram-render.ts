import {
  directionFor,
  edgeOnPath,
  layoutGraph,
  nodeHighlighted,
  renderNodeBox,
  renderRoutedEdge
} from './layout.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import type { StateDiagramInput } from './state-diagram-schema.js'

/**
 * State-diagram renderer. States layer through the shared layout engine
 * exactly like flow-diagram; the start dot, double-bordered finals and
 * self-transition loops are the only additions. Pure builders shared by
 * the Node build and the browser client.
 */

export const STATE_DIAGRAM_WIDTH = 640

const START_GAP = 30

const ARROW_LEN = 9

export interface StateRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

export function renderStateDiagram(input: StateDiagramInput, options: StateRenderOptions): string {
  const width = Math.max(300, options.width)
  const direction = directionFor(undefined, width)
  const layout = layoutGraph(input.states, input.transitions, { direction, span: width })
  const highlight: ReadonlyArray<string> = input.highlight ?? []

  const finalOf = new Map<string, boolean>()

  for (const state of input.states) {
    finalOf.set(state.id, state.final ?? false)
  }

  let start = ''

  for (const box of layout.boxes) {
    if (box.id !== input.initial) {
      continue
    }

    if (direction === 'lr') {
      const dotX = box.x - START_GAP
      const dotY = box.y + box.h / 2
      start = `<g class="edge start" data-edge="" data-from="${escapeAttr(box.id)}" data-to="${escapeAttr(box.id)}"><circle cx="${coord(dotX)}" cy="${coord(dotY)}" r="5" class="sdot"/><path d="M${coord(dotX + 5)} ${coord(dotY)} H${coord(box.x - ARROW_LEN)}"/><polygon points="${coord(box.x)},${coord(dotY)} ${coord(box.x - ARROW_LEN)},${coord(dotY - 4)} ${coord(box.x - ARROW_LEN)},${coord(dotY + 4)}"/></g>`
    } else {
      const dotX = box.x + box.w / 2
      const dotY = box.y - START_GAP
      start = `<g class="edge start" data-edge="" data-from="${escapeAttr(box.id)}" data-to="${escapeAttr(box.id)}"><circle cx="${coord(dotX)}" cy="${coord(dotY)}" r="5" class="sdot"/><path d="M${coord(dotX)} ${coord(dotY + 5)} V${coord(box.y - ARROW_LEN)}"/><polygon points="${coord(dotX)},${coord(box.y)} ${coord(dotX - 4)},${coord(box.y - ARROW_LEN)} ${coord(dotX + 4)},${coord(box.y - ARROW_LEN)}"/></g>`
    }
  }

  let edges = start

  for (const edge of layout.edges) {
    edges += renderRoutedEdge(edge, edgeOnPath(edge.from, edge.to, highlight))
  }

  let nodes = ''

  for (const box of layout.boxes) {
    const final = finalOf.get(box.id) ?? false

    const inner = final
      ? `<rect x="${coord(box.x + 4)}" y="${coord(box.y + 4)}" width="${coord(box.w - 8)}" height="${coord(box.h - 8)}" class="nfinal"/>`
      : ''

    nodes += renderNodeBox(box, {
      highlight: nodeHighlighted(box.id, highlight),
      extraClass: final ? ' final' : '',
      inner,
      focusable: true
    })
  }

  const svg = `<svg viewBox="0 0 ${coord(layout.width)} ${coord(layout.height)}" role="presentation" data-direction="${direction}">${edges}${nodes}</svg>`

  const names: Array<string> = []

  for (const state of input.states) {
    names.push(state.label)
  }

  const aria =
    input.title === undefined
      ? `State diagram: ${names.join(', ')}`
      : `${input.title}: ${names.join(', ')}`

  const title = input.title === undefined ? '' : `<p class="dtitle">${escapeHtml(input.title)}</p>`

  return `<div class="aha-diagram aha-state" data-diagram="state-diagram" data-diagram-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}</div>`
}
