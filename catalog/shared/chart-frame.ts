import { coord, escapeAttr, escapeHtml } from './svg.js'
import type { ChartTick } from './ticks.js'

/**
 * Shared chart frame: plot layout, axes with a few labelled ticks, direct
 * series labels with collision avoidance, and the tooltip shell.
 */

export interface FrameMargins {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export interface FrameLayout {
  readonly width: number
  readonly height: number
  readonly plotX: number
  readonly plotY: number
  readonly plotWidth: number
  readonly plotHeight: number
}

export interface FrameInput {
  readonly width: number
  readonly height: number
  readonly leftGutter: number
  readonly margins?: FrameMarginOverride
}

export interface FrameMarginOverride {
  readonly top?: number
  readonly right?: number
  readonly bottom?: number
  readonly left?: number
}

export function layoutFrame(input: FrameInput): FrameLayout {
  const margins: FrameMargins = {
    top: input.margins?.top ?? 14,
    right: input.margins?.right ?? 92,
    bottom: input.margins?.bottom ?? 30,
    left: input.margins?.left ?? input.leftGutter
  }

  const plotX = margins.left
  const plotY = margins.top
  const plotWidth = Math.max(80, input.width - margins.left - margins.right)
  const plotHeight = Math.max(80, input.height - margins.top - margins.bottom)

  return {
    width: input.width,
    height: input.height,
    plotX,
    plotY,
    plotWidth,
    plotHeight
  }
}

export interface AxisRenderInput {
  readonly ticks: ReadonlyArray<ChartTick>
  readonly positions: ReadonlyArray<number>
  readonly orientation: 'x' | 'y'
  readonly plotX: number
  readonly plotY: number
  readonly plotWidth: number
  readonly plotHeight: number
  readonly side?: 'left' | 'right'
  readonly grid?: boolean
}

export function renderAxis(input: AxisRenderInput): string {
  let out = ''
  const side = input.side ?? 'left'
  const grid = input.grid ?? true

  for (let index = 0; index < input.ticks.length; index += 1) {
    const tick = input.ticks[index]
    const position = input.positions[index]

    if (tick === undefined || position === undefined) {
      continue
    }

    if (input.orientation === 'x') {
      out += `<line x1="${coord(position)}" y1="${coord(input.plotY)}" x2="${coord(position)}" y2="${coord(input.plotY + input.plotHeight)}" class="grid"/>`
      out += `<text x="${coord(position)}" y="${coord(input.plotY + input.plotHeight + 18)}" text-anchor="middle" class="tick">${escapeHtml(tick.label)}</text>`
      continue
    }

    if (side === 'right') {
      if (grid) {
        out += `<line x1="${coord(input.plotX)}" y1="${coord(position)}" x2="${coord(input.plotX + input.plotWidth)}" y2="${coord(position)}" class="grid"/>`
      }

      out += `<text x="${coord(input.plotX + input.plotWidth + 8)}" y="${coord(position + 4)}" text-anchor="start" class="tick">${escapeHtml(tick.label)}</text>`
      continue
    }

    out += `<line x1="${coord(input.plotX)}" y1="${coord(position)}" x2="${coord(input.plotX + input.plotWidth)}" y2="${coord(position)}" class="grid"/>`
    out += `<text x="${coord(input.plotX - 8)}" y="${coord(position + 4)}" text-anchor="end" class="tick">${escapeHtml(tick.label)}</text>`
  }

  return out
}

export interface LabelSlot {
  readonly seriesIndex: number
  readonly name: string
  readonly x: number
  readonly y: number
}

export interface PlacedLabel extends LabelSlot {
  placedY: number
}

/**
 * Place direct series labels at the right edge with collision avoidance.
 * Labels keep input order for stability; overlapping ones push downward
 * with a minimum gap.
 */
export interface LabelBounds {
  readonly minY: number
  readonly maxY: number
}

export function placeSeriesLabels(
  slots: ReadonlyArray<LabelSlot>,
  bounds: LabelBounds | null
): ReadonlyArray<PlacedLabel> {
  const gap = 15
  const sorted = slots.slice().sort((left, right) => left.y - right.y)
  const placed: Array<PlacedLabel> = []
  let cursor = Number.NEGATIVE_INFINITY

  for (const slot of sorted) {
    const target = Math.max(slot.y, cursor + gap)
    placed.push({ ...slot, placedY: target })
    cursor = target
  }

  if (bounds !== null && placed.length > 0) {
    const last = placed[placed.length - 1]

    if (last !== undefined && last.placedY > bounds.maxY) {
      const shift = last.placedY - bounds.maxY

      for (const label of placed) {
        label.placedY -= shift
      }

      const first = placed[0]

      if (first !== undefined && first.placedY < bounds.minY) {
        const down = bounds.minY - first.placedY

        for (const label of placed) {
          label.placedY += down
        }
      }
    }
  }

  return placed.sort((left, right) => left.seriesIndex - right.seriesIndex)
}

export interface SeriesLabelInput {
  readonly labels: ReadonlyArray<PlacedLabel>
  readonly highlighted: ReadonlyArray<boolean>
}

export function renderSeriesLabels(input: SeriesLabelInput): string {
  let out = ''

  for (const label of input.labels) {
    const isHi = input.highlighted[label.seriesIndex] ?? false
    const cls = isHi ? 'slabel hi' : 'slabel'
    out += `<text x="${label.x}" y="${label.placedY + 4}" class="${cls}" data-series="${String(label.seriesIndex)}">${escapeHtml(label.name)}</text>`
  }

  return out
}

export function renderAxisCaption(
  text: string,
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end'
): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="axis-cap">${escapeAttr(text)}</text>`
}

export function tooltipShell(): string {
  return '<div class="aha-tip" hidden="hidden"></div>'
}

export interface EndLabelSlot {
  readonly seriesIndex: number
  readonly name: string
  readonly x: number
  readonly y: number
}

export interface PlacedEndLabel extends EndLabelSlot {
  readonly lx: number
  readonly placedY: number
  readonly displaced: boolean
}

export interface EndLabelBounds {
  readonly minY: number
  readonly maxY: number
  readonly maxX: number
}

function estimateLabelWidth(name: string): number {
  return name.length * 6.5 + 6
}

/**
 * Place direct series labels next to their line's end point. Labels sit
 * just right of the end dot, clamped inside the svg width, with vertical
 * collision avoidance; a leader line connects a label only when it had to
 * move away from its dot.
 */
export function placeEndLabels(
  slots: ReadonlyArray<EndLabelSlot>,
  bounds: EndLabelBounds | null
): ReadonlyArray<PlacedEndLabel> {
  const gap = 15
  const sorted = slots.slice().sort((left, right) => left.y - right.y)
  const placed: Array<PlacedEndLabel> = []
  let cursor = Number.NEGATIVE_INFINITY

  for (const slot of sorted) {
    const target = Math.max(slot.y, cursor + gap)
    let lx = slot.x + 7

    if (bounds !== null) {
      const cap = bounds.maxX - estimateLabelWidth(slot.name)

      if (lx > cap) {
        lx = Math.max(slot.x + 7, cap)
      }
    }

    placed.push({ ...slot, lx, placedY: target, displaced: Math.abs(target - slot.y) > 8 })
    cursor = target
  }

  if (bounds !== null && placed.length > 0) {
    const last = placed[placed.length - 1]

    if (last !== undefined && last.placedY > bounds.maxY) {
      const shift = last.placedY - bounds.maxY

      for (let index = 0; index < placed.length; index += 1) {
        const label = placed[index]

        if (label !== undefined) {
          placed[index] = { ...label, placedY: label.placedY - shift }
        }
      }

      const first = placed[0]

      if (first !== undefined && first.placedY < bounds.minY) {
        const down = bounds.minY - first.placedY

        for (let index = 0; index < placed.length; index += 1) {
          const label = placed[index]

          if (label !== undefined) {
            placed[index] = { ...label, placedY: label.placedY + down }
          }
        }
      }
    }

    for (let index = 0; index < placed.length; index += 1) {
      const label = placed[index]

      if (label !== undefined) {
        placed[index] = { ...label, displaced: Math.abs(label.placedY - label.y) > 8 }
      }
    }
  }

  return placed.sort((left, right) => left.seriesIndex - right.seriesIndex)
}

export interface EndLabelInput {
  readonly labels: ReadonlyArray<PlacedEndLabel>
  readonly highlighted: ReadonlyArray<boolean>
}

export function renderEndLabels(input: EndLabelInput): string {
  let out = ''

  for (const label of input.labels) {
    const isHi = input.highlighted[label.seriesIndex] ?? false
    const cls = isHi ? 'slabel hi' : 'slabel'

    if (label.displaced) {
      out += `<line x1="${coord(label.x + 2)}" y1="${coord(label.y)}" x2="${coord(label.lx - 3)}" y2="${coord(label.placedY)}" class="leader"/>`
    }

    out += `<text x="${coord(label.lx)}" y="${coord(label.placedY + 4)}" class="${cls}" data-series="${String(label.seriesIndex)}">${escapeHtml(label.name)}</text>`
  }

  return out
}
