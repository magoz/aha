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
}

export function layoutFrame(input: FrameInput): FrameLayout {
  const margins: FrameMargins = { top: 14, right: 92, bottom: 30, left: input.leftGutter }
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
}

export function renderAxis(input: AxisRenderInput): string {
  let out = ''

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
