import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'

/**
 * Shared diagram layout engine. Deterministic layered boxes for the
 * node-link diagrams (flow, state, tree connectors): longest-path layering
 * plus barycentric crossing reduction, fixed box metrics so repeated runs
 * produce identical SVG with no box overlaps. Pure string builders shared
 * by the Node build and the browser clients; no Effect, Schema or DOM here.
 */

export interface LayoutNodeInput {
  readonly id: string
  readonly label: string
}

export interface LayoutEdgeInput {
  readonly from: string
  readonly to: string
  readonly label?: string | undefined
}

export type GraphDirection = 'lr' | 'tb'

export interface GraphLayoutOptions {
  readonly direction: GraphDirection
  /** Container width in px; the layout sizes to it 1:1 when it fits. */
  readonly span: number
}

export interface PlacedBox {
  readonly id: string
  readonly lines: ReadonlyArray<string>
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly layer: number
  readonly slot: number
}

export interface PlacedEdge {
  readonly from: string
  readonly to: string
  readonly label: string | null
  readonly d: string
  readonly tipX: number
  readonly tipY: number
  readonly angle: number
  readonly labelX: number
  readonly labelY: number
  readonly back: boolean
  readonly self: boolean
}

export interface GraphLayout {
  readonly boxes: ReadonlyArray<PlacedBox>
  readonly edges: ReadonlyArray<PlacedEdge>
  readonly width: number
  readonly height: number
  readonly direction: GraphDirection
}

const SINGLE_H = 38

const DOUBLE_H = 54

const CHAR_W = 6.6

const BOX_PAD_X = 15

const MIN_BOX_W = 72

const MAX_BOX_W = 216

const WRAP_CHARS = 28

const GAP_X_LR = 72

const GAP_X_TB = 28

const GAP_Y_LR = 26

const GAP_Y_TB = 56

const PAD = 10

const GROUP_TOP = 30

const BACK_LANE = 18

const ARROW_LEN = 9

/** Word-wrap a label to at most two lines of safeMax chars. */
export function wrapLabel(label: string, maxChars: number): ReadonlyArray<string> {
  const safeMax = Math.max(8, Math.floor(maxChars))
  const words: Array<string> = []
  const rawWords = label.split(' ')

  for (const raw of rawWords) {
    if (raw.length === 0) {
      continue
    }

    let rest = raw

    while (rest.length > safeMax) {
      words.push(rest.slice(0, safeMax))
      rest = rest.slice(safeMax)
    }

    words.push(rest)
  }

  if (words.length === 0) {
    return ['']
  }

  const lines: Array<string> = []
  let current = ''

  for (const word of words) {
    if (current.length === 0) {
      current = word
      continue
    }

    if (current.length + 1 + word.length <= safeMax) {
      current += ` ${word}`
      continue
    }

    lines.push(current)
    current = word
  }

  if (current.length > 0) {
    lines.push(current)
  }

  if (lines.length <= 2) {
    return lines
  }

  const first = lines[0] ?? ''
  const second = lines[1] ?? ''

  return [first, `${second.slice(0, safeMax - 1)}…`]
}

export interface MeasuredLabel {
  readonly lines: ReadonlyArray<string>
  readonly w: number
  readonly h: number
}

export function measureLabel(label: string): MeasuredLabel {
  const lines = wrapLabel(label, WRAP_CHARS)
  let longest = 0

  for (const line of lines) {
    if (line.length > longest) {
      longest = line.length
    }
  }

  const w = Math.min(MAX_BOX_W, Math.max(MIN_BOX_W, longest * CHAR_W + BOX_PAD_X * 2))

  return { lines, w, h: lines.length > 1 ? DOUBLE_H : SINGLE_H }
}

/** Auto direction: left-to-right on wide containers, top-to-bottom below 560px. */
export function directionFor(
  requested: 'auto' | GraphDirection | undefined,
  span: number
): GraphDirection {
  if (requested === 'lr' || requested === 'tb') {
    return requested
  }

  return span < 560 ? 'tb' : 'lr'
}

function isDateText(value: number | string): value is string {
  return value === String(value)
}

/** Parse an ISO date string or epoch millis; null when unusable. */
export function parseDiagramDate(value: number | string): number | null {
  if (isDateText(value)) {
    const millis = Date.parse(value)

    return Number.isNaN(millis) ? null : millis
  }

  return Number.isFinite(value) ? value : null
}

function indexOf(nodes: ReadonlyArray<LayoutNodeInput>): Map<string, number> {
  const out = new Map<string, number>()

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]

    if (node !== undefined && !out.has(node.id)) {
      out.set(node.id, index)
    }
  }

  return out
}

interface InternalEdge {
  readonly from: number
  readonly to: number
  readonly label: string | null
}

/** Edges whose endpoints both exist; self loops excluded for layering. */
function internalEdges(
  nodes: ReadonlyArray<LayoutNodeInput>,
  edges: ReadonlyArray<LayoutEdgeInput>,
  index: Map<string, number>,
  includeSelf: boolean
): Array<InternalEdge> {
  const out: Array<InternalEdge> = []

  for (const edge of edges) {
    const from = index.get(edge.from)
    const to = index.get(edge.to)

    if (from === undefined || to === undefined) {
      continue
    }

    if (from === to && !includeSelf) {
      continue
    }

    out.push({ from, to, label: edge.label ?? null })
  }

  return out
}

/** Kahn pass in input order; stragglers (cycles) layer deterministically after. */
function assignLayers(count: number, links: ReadonlyArray<InternalEdge>): Array<number> {
  const indegree: Array<number> = []
  const layer: Array<number> = []

  for (let index = 0; index < count; index += 1) {
    indegree.push(0)
    layer.push(-1)
  }

  for (const link of links) {
    const slot = indegree[link.to]

    if (slot !== undefined) {
      indegree[link.to] = slot + 1
    }
  }

  const queue: Array<number> = []

  for (let index = 0; index < count; index += 1) {
    if (indegree[index] === 0) {
      queue.push(index)
    }
  }

  const order: Array<number> = []

  while (queue.length > 0) {
    let pick = 0

    for (let scan = 1; scan < queue.length; scan += 1) {
      const candidate = queue[scan]
      const current = queue[pick]

      if (candidate !== undefined && current !== undefined && candidate < current) {
        pick = scan
      }
    }

    const next = queue.splice(pick, 1)[0]

    if (next === undefined) {
      break
    }

    order.push(next)

    for (const link of links) {
      if (link.from !== next) {
        continue
      }

      const slot = indegree[link.to]

      if (slot !== undefined) {
        indegree[link.to] = slot - 1

        if (slot - 1 === 0) {
          queue.push(link.to)
        }
      }
    }
  }

  for (const node of order) {
    let best = -1

    for (const link of links) {
      if (link.to !== node) {
        continue
      }

      const pred = layer[link.from] ?? -1

      if (pred > best) {
        best = pred
      }
    }

    layer[node] = best + 1
  }

  let ceiling = -1

  for (const value of layer) {
    if (value > ceiling) {
      ceiling = value
    }
  }

  for (let index = 0; index < count; index += 1) {
    if (layer[index] !== -1) {
      continue
    }

    let best = ceiling

    for (const link of links) {
      if (link.to !== index) {
        continue
      }

      const pred = layer[link.from] ?? -1

      if (pred > best) {
        best = pred
      }
    }

    layer[index] = best + 1
    ceiling = best + 1
  }

  return layer
}

function barycenter(neighbours: ReadonlyArray<number>): number | null {
  if (neighbours.length === 0) {
    return null
  }

  let sum = 0

  for (const slot of neighbours) {
    sum += slot
  }

  return sum / neighbours.length
}

/** Two barycentric sweeps to cut edge crossings; ties keep input order. */
function orderLayers(
  count: number,
  links: ReadonlyArray<InternalEdge>,
  layer: ReadonlyArray<number>,
  maxLayer: number
): Array<number> {
  const slot: Array<number> = []

  for (let index = 0; index < count; index += 1) {
    slot.push(0)
  }

  for (let depth = 0; depth <= maxLayer; depth += 1) {
    let rank = 0

    for (let index = 0; index < count; index += 1) {
      if (layer[index] === depth) {
        slot[index] = rank
        rank += 1
      }
    }
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (let depth = 1; depth <= maxLayer; depth += 1) {
      const members: Array<number> = []

      for (let index = 0; index < count; index += 1) {
        if (layer[index] === depth) {
          members.push(index)
        }
      }

      members.sort((left, right) => {
        const leftPreds: Array<number> = []
        const rightPreds: Array<number> = []

        for (const link of links) {
          if (link.to === left) {
            leftPreds.push(slot[link.from] ?? 0)
          }

          if (link.to === right) {
            rightPreds.push(slot[link.from] ?? 0)
          }
        }

        const leftBary = barycenter(leftPreds) ?? slot[left] ?? 0
        const rightBary = barycenter(rightPreds) ?? slot[right] ?? 0

        if (leftBary !== rightBary) {
          return leftBary - rightBary
        }

        return left - right
      })

      for (let rank = 0; rank < members.length; rank += 1) {
        const node = members[rank]

        if (node !== undefined) {
          slot[node] = rank
        }
      }
    }

    for (let depth = maxLayer - 1; depth >= 0; depth -= 1) {
      const members: Array<number> = []

      for (let index = 0; index < count; index += 1) {
        if (layer[index] === depth) {
          members.push(index)
        }
      }

      members.sort((left, right) => {
        const leftSuccs: Array<number> = []
        const rightSuccs: Array<number> = []

        for (const link of links) {
          if (link.from === left) {
            leftSuccs.push(slot[link.to] ?? 0)
          }

          if (link.from === right) {
            rightSuccs.push(slot[link.to] ?? 0)
          }
        }

        const leftBary = barycenter(leftSuccs) ?? slot[left] ?? 0
        const rightBary = barycenter(rightSuccs) ?? slot[right] ?? 0

        if (leftBary !== rightBary) {
          return leftBary - rightBary
        }

        return left - right
      })

      for (let rank = 0; rank < members.length; rank += 1) {
        const node = members[rank]

        if (node !== undefined) {
          slot[node] = rank
        }
      }
    }
  }

  return slot
}

function arrowPoints(tipX: number, tipY: number, angle: number): string {
  const back = angle + Math.PI
  const spread = 0.42
  const leftX = tipX + ARROW_LEN * Math.cos(back - spread)
  const leftY = tipY + ARROW_LEN * Math.sin(back - spread)
  const rightX = tipX + ARROW_LEN * Math.cos(back + spread)
  const rightY = tipY + ARROW_LEN * Math.sin(back + spread)

  return `${coord(tipX)},${coord(tipY)} ${coord(leftX)},${coord(leftY)} ${coord(rightX)},${coord(rightY)}`
}

export function layoutGraph(
  nodes: ReadonlyArray<LayoutNodeInput>,
  edges: ReadonlyArray<LayoutEdgeInput>,
  options: GraphLayoutOptions
): GraphLayout {
  const count = nodes.length
  const span = Math.max(300, Math.round(options.span))
  const index = indexOf(nodes)
  const links = internalEdges(nodes, edges, index, false)
  const layer = assignLayers(count, links)

  let maxLayer = 0

  for (const value of layer) {
    if (value > maxLayer) {
      maxLayer = value
    }
  }

  const slot = orderLayers(count, links, layer, maxLayer)

  const widths: Array<number> = []
  const heights: Array<number> = []

  for (const node of nodes) {
    const measured = measureLabel(node.label)
    widths.push(measured.w)
    heights.push(measured.h)
  }

  const boxes: Array<PlacedBox> = []

  for (let index = 0; index < count; index += 1) {
    boxes.push({
      id: nodes[index]?.id ?? `n${String(index)}`,
      lines: [],
      x: 0,
      y: 0,
      w: widths[index] ?? MIN_BOX_W,
      h: heights[index] ?? SINGLE_H,
      layer: layer[index] ?? 0,
      slot: slot[index] ?? 0
    })
  }

  const topPad = PAD + GROUP_TOP
  let width = span
  let height = topPad + PAD

  if (options.direction === 'lr') {
    const layerW: Array<number> = []

    for (let depth = 0; depth <= maxLayer; depth += 1) {
      let best = MIN_BOX_W

      for (const box of boxes) {
        if (box.layer === depth && box.w > best) {
          best = box.w
        }
      }

      layerW.push(best)
    }

    const layerX: Array<number> = []
    let cursor = PAD

    for (let depth = 0; depth <= maxLayer; depth += 1) {
      layerX.push(cursor)
      cursor += (layerW[depth] ?? MIN_BOX_W) + GAP_X_LR
    }

    const naturalW = cursor - GAP_X_LR + PAD

    if (naturalW > width) {
      width = naturalW
    }

    const membersByLayer: Array<Array<number>> = []

    for (let depth = 0; depth <= maxLayer; depth += 1) {
      membersByLayer.push([])
    }

    for (let index = 0; index < count; index += 1) {
      const depth = layer[index] ?? 0
      const members = membersByLayer[depth]

      if (members !== undefined) {
        members.push(index)
      }
    }

    for (const members of membersByLayer) {
      members.sort((left, right) => (slot[left] ?? 0) - (slot[right] ?? 0) || left - right)
    }

    let tallest = 0

    for (const members of membersByLayer) {
      let block = 0

      for (const member of members) {
        block += (heights[member] ?? SINGLE_H) + GAP_Y_LR
      }

      if (members.length > 0) {
        block -= GAP_Y_LR
      }

      if (block > tallest) {
        tallest = block
      }
    }

    height = topPad + tallest + PAD

    for (let depth = 0; depth <= maxLayer; depth += 1) {
      const members = membersByLayer[depth] ?? []
      let block = 0

      for (const member of members) {
        block += (heights[member] ?? SINGLE_H) + GAP_Y_LR
      }

      if (members.length > 0) {
        block -= GAP_Y_LR
      }

      let y = topPad + (tallest - block) / 2

      for (const member of members) {
        const box = boxes[member]

        if (box === undefined) {
          continue
        }

        boxes[member] = {
          ...box,
          x: (layerX[depth] ?? PAD) + ((layerW[depth] ?? box.w) - box.w) / 2,
          y
        }
        y += box.h + GAP_Y_LR
      }
    }
  } else {
    let widest = 0

    for (const box of boxes) {
      if (box.w > widest) {
        widest = box.w
      }
    }

    const pitch = widest + GAP_X_TB

    for (let depth = 0; depth <= maxLayer; depth += 1) {
      const members: Array<number> = []

      for (let index = 0; index < count; index += 1) {
        if ((layer[index] ?? 0) === depth) {
          members.push(index)
        }
      }

      members.sort((left, right) => (slot[left] ?? 0) - (slot[right] ?? 0) || left - right)
      const block = members.length * pitch - GAP_X_TB
      let cx = width / 2 - block / 2

      for (const member of members) {
        const box = boxes[member]

        if (box === undefined) {
          continue
        }

        boxes[member] = {
          ...box,
          x: cx + (pitch - box.w) / 2,
          y: topPad + depth * (DOUBLE_H + GAP_Y_TB)
        }
        cx += pitch
      }
    }

    let deepest = 0

    for (const box of boxes) {
      const bottom = box.y + box.h

      if (bottom > deepest) {
        deepest = bottom
      }
    }

    height = deepest + PAD
  }

  for (let index = 0; index < count; index += 1) {
    const node = nodes[index]
    const box = boxes[index]

    if (node !== undefined && box !== undefined) {
      boxes[index] = { ...box, lines: measureLabel(node.label).lines }
    }
  }

  const placedEdges: Array<PlacedEdge> = []
  let backCount = 0

  for (const edge of edges) {
    const from = index.get(edge.from)
    const to = index.get(edge.to)

    if (from === undefined || to === undefined) {
      continue
    }

    const source = boxes[from]
    const target = boxes[to]

    if (source === undefined || target === undefined) {
      continue
    }

    const label = edge.label ?? null

    if (from === to) {
      const x0 = source.x + source.w - 18
      const y0 = source.y
      const tipX = x0 - 8
      const tipY = y0 - 1
      placedEdges.push({
        from: edge.from,
        to: edge.to,
        label,
        d: `M${coord(x0)} ${coord(y0)} C${coord(x0 + 22)} ${coord(y0 - 30)} ${coord(x0 + 2)} ${coord(y0 - 30)} ${coord(tipX)} ${coord(tipY)}`,
        tipX,
        tipY,
        angle: Math.PI / 2,
        labelX: x0 + 8,
        labelY: y0 - 30,
        back: false,
        self: true
      })
      continue
    }

    const fromLayer = source.layer
    const toLayer = target.layer

    if (toLayer > fromLayer) {
      let x1 = 0
      let y1 = 0
      let x2 = 0
      let y2 = 0

      if (options.direction === 'lr') {
        x1 = source.x + source.w
        y1 = source.y + source.h / 2
        x2 = target.x
        y2 = target.y + target.h / 2
      } else {
        x1 = source.x + source.w / 2
        y1 = source.y + source.h
        x2 = target.x + target.w / 2
        y2 = target.y
      }

      const angle = Math.atan2(y2 - y1, x2 - x1)
      const tipX = x2
      const tipY = y2
      const endX = x2 - ARROW_LEN * Math.cos(angle)
      const endY = y2 - ARROW_LEN * Math.sin(angle)

      placedEdges.push({
        from: edge.from,
        to: edge.to,
        label,
        d: `M${coord(x1)} ${coord(y1)} L${coord(endX)} ${coord(endY)}`,
        tipX,
        tipY,
        angle,
        labelX: (x1 + x2) / 2,
        labelY: (y1 + y2) / 2 - 6,
        back: false,
        self: false
      })
      continue
    }

    const lane = backCount
    backCount += 1

    if (options.direction === 'lr') {
      const xS = source.x + source.w / 2
      const yS = source.y + source.h
      const xT = target.x + target.w / 2
      const yT = target.y + target.h
      const laneY = height + 4 + lane * BACK_LANE
      height = laneY + PAD

      placedEdges.push({
        from: edge.from,
        to: edge.to,
        label,
        d: `M${coord(xS)} ${coord(yS)} V${coord(laneY)} H${coord(xT)} V${coord(yT + ARROW_LEN)}`,
        tipX: xT,
        tipY: yT,
        angle: -Math.PI / 2,
        labelX: (xS + xT) / 2,
        labelY: laneY - 5,
        back: true,
        self: false
      })
    } else {
      const xS = source.x + source.w
      const yS = source.y + source.h / 2
      const xT = target.x + target.w
      const yT = target.y + target.h / 2
      const laneX = width + 4 + lane * BACK_LANE
      width = laneX + PAD

      placedEdges.push({
        from: edge.from,
        to: edge.to,
        label,
        d: `M${coord(xS)} ${coord(yS)} H${coord(laneX)} V${coord(yT)} H${coord(xT + ARROW_LEN)}`,
        tipX: xT,
        tipY: yT,
        angle: Math.PI,
        labelX: laneX + 4,
        labelY: (yS + yT) / 2 - 4,
        back: true,
        self: false
      })
    }
  }

  return { boxes, edges: placedEdges, width, height, direction: options.direction }
}

export interface GroupBounds {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Hairline bounds around a set of member boxes; null when empty. */
export function groupBounds(
  boxes: ReadonlyArray<PlacedBox>,
  memberIds: ReadonlyArray<string>
): GroupBounds | null {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let found = false

  for (const id of memberIds) {
    for (const box of boxes) {
      if (box.id !== id) {
        continue
      }

      found = true

      if (box.x < minX) {
        minX = box.x
      }

      if (box.y < minY) {
        minY = box.y
      }

      if (box.x + box.w > maxX) {
        maxX = box.x + box.w
      }

      if (box.y + box.h > maxY) {
        maxY = box.y + box.h
      }
    }
  }

  if (!found) {
    return null
  }

  return {
    x: minX - 14,
    y: minY - GROUP_TOP + 8,
    w: maxX - minX + 28,
    h: maxY - minY + GROUP_TOP + 6
  }
}

/** True when an edge runs between two consecutive ids in a highlight path. */
export function edgeOnPath(from: string, to: string, highlight: ReadonlyArray<string>): boolean {
  for (let index = 0; index + 1 < highlight.length; index += 1) {
    if (highlight[index] === from && highlight[index + 1] === to) {
      return true
    }
  }

  return false
}

export function nodeHighlighted(id: string, highlight: ReadonlyArray<string>): boolean {
  for (const entry of highlight) {
    if (entry === id) {
      return true
    }
  }

  return false
}

/** SVG polygon points for a filled arrowhead at the edge tip. */
export function arrowPointsFor(edge: PlacedEdge): string {
  return arrowPoints(edge.tipX, edge.tipY, edge.angle)
}

/** Render one node box with centred label lines. */
export function renderNodeBox(
  box: PlacedBox,
  options: {
    readonly highlight: boolean
    readonly extraClass: string
    readonly inner: string
    readonly focusable: boolean
  }
): string {
  const cls = options.highlight ? `node hi${options.extraClass}` : `node${options.extraClass}`

  const focus = options.focusable
    ? ` tabindex="0" role="button" aria-label="${escapeAttr(box.lines.join(' '))}"`
    : ''

  let text = ''

  if (box.lines.length === 1) {
    text = `<text x="${coord(box.x + box.w / 2)}" y="${coord(box.y + box.h / 2 + 4)}" text-anchor="middle" class="ntext">${escapeHtml(box.lines[0] ?? '')}</text>`
  } else {
    const first = box.lines[0] ?? ''
    const second = box.lines[1] ?? ''
    text = `<text x="${coord(box.x + box.w / 2)}" y="${coord(box.y + box.h / 2 - 3)}" text-anchor="middle" class="ntext">${escapeHtml(first)}</text>`
    text += `<text x="${coord(box.x + box.w / 2)}" y="${coord(box.y + box.h / 2 + 10)}" text-anchor="middle" class="ntext">${escapeHtml(second)}</text>`
  }

  return `<g class="${cls}" data-node="${escapeAttr(box.id)}"${focus}><rect x="${coord(box.x)}" y="${coord(box.y)}" width="${coord(box.w)}" height="${coord(box.h)}" class="nrect"/>${options.inner}${text}</g>`
}

/** Render one routed edge: path, polygon arrowhead and optional label. */
export function renderRoutedEdge(edge: PlacedEdge, highlight: boolean): string {
  const cls = highlight ? 'edge hi' : 'edge'

  const label =
    edge.label === null
      ? ''
      : `<text x="${coord(edge.labelX)}" y="${coord(edge.labelY)}" text-anchor="middle" class="elbl">${escapeHtml(edge.label)}</text>`

  return `<g class="${cls}" data-edge="" data-from="${escapeAttr(edge.from)}" data-to="${escapeAttr(edge.to)}"><path d="${edge.d}"/><polygon points="${arrowPointsFor(edge)}"/>${label}</g>`
}
