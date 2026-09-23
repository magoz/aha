import type { ChartStop } from '../shared/chart-client.js'
import { defaultNumberFormat, formatNumberValue } from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { coord, escapeAttr, escapeHtml, linePath } from '../shared/svg.js'
import type { PlotPoint } from '../shared/svg.js'
import type { SparklineInput } from './sparkline-schema.js'

/**
 * Sparkline renderer. A tiny inline trend with an optional last value and
 * min/max markers. Fixed viewBox geometry scales with CSS, so the browser
 * client only adds hover values and never re-renders.
 */

export const SPARKLINE_WIDTH = 120

export const SPARKLINE_HEIGHT = 36

function readFormat(raw: SparklineInput['format']): NumberFormatSpec {
  if (raw === undefined) {
    return defaultNumberFormat()
  }

  return {
    style: raw.style ?? 'decimal',
    currency: raw.currency ?? null,
    digits: raw.digits ?? null
  }
}

interface SparkStats {
  readonly min: number
  readonly max: number
  readonly last: number
  readonly lastIndex: number
}

function sparkStats(values: ReadonlyArray<number | null>): SparkStats | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let last = 0
  let lastIndex = -1

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]

    if (value === undefined || value === null) {
      continue
    }

    if (value < min) {
      min = value
    }

    if (value > max) {
      max = value
    }

    last = value
    lastIndex = index
  }

  if (lastIndex < 0) {
    return null
  }

  return { min, max, last, lastIndex }
}

function sparkPoint(value: number, index: number, count: number, stats: SparkStats): PlotPoint {
  const pad = 4
  const innerW = SPARKLINE_WIDTH - pad * 2
  const innerH = SPARKLINE_HEIGHT - pad * 2
  const span = stats.max - stats.min
  const x = count < 2 ? pad : pad + (innerW * index) / (count - 1)
  const y = span === 0 ? pad + innerH / 2 : pad + innerH * (1 - (value - stats.min) / span)

  return { x, y }
}

export function renderSparkline(input: SparklineInput, idPrefix: string): string {
  const format = readFormat(input.format)
  const stats = sparkStats(input.values)

  if (stats === null) {
    return `<span class="aha-spark" data-chart-id="${escapeAttr(idPrefix)}"><span class="sv">no data</span></span>`
  }

  const count = input.values.length
  let segments: Array<PlotPoint> = []
  let svg = `<svg viewBox="0 0 ${String(SPARKLINE_WIDTH)} ${String(SPARKLINE_HEIGHT)}" role="presentation">`

  const flush = (): void => {
    if (segments.length > 1) {
      svg += `<path d="${linePath(segments)}" class="spark-line"/>`
    }

    segments = []
  }

  for (let index = 0; index < count; index += 1) {
    const value = input.values[index]

    if (value === undefined || value === null) {
      flush()
      continue
    }

    segments.push(sparkPoint(value, index, count, stats))
  }

  flush()

  if (input.markExtremes ?? true) {
    for (let index = 0; index < count; index += 1) {
      const value = input.values[index]

      if (value === undefined || value === null) {
        continue
      }

      if (value === stats.min || value === stats.max) {
        const point = sparkPoint(value, index, count, stats)
        const cls = value === stats.max ? 'spark-max' : 'spark-min'
        svg += `<circle cx="${coord(point.x)}" cy="${coord(point.y)}" r="2.5" class="${cls}" data-stop="${String(index)}"><title>${escapeAttr(formatNumberValue(value, format))}</title></circle>`
      }
    }
  }

  const lastPoint = sparkPoint(stats.last, stats.lastIndex, count, stats)
  svg += `<circle cx="${coord(lastPoint.x)}" cy="${coord(lastPoint.y)}" r="3" class="spark-last" data-stop="${String(stats.lastIndex)}"><title>${escapeAttr(formatNumberValue(stats.last, format))}</title></circle>`
  svg += '</svg>'

  const labelledBy = input.label === undefined ? 'sparkline' : input.label
  const aria = `${labelledBy}: last ${formatNumberValue(stats.last, format)}, low ${formatNumberValue(stats.min, format)}, high ${formatNumberValue(stats.max, format)}`

  const valueText =
    (input.showLast ?? true)
      ? `<span class="sv">${input.label === undefined ? '' : `${escapeHtml(input.label)} `}${escapeHtml(formatNumberValue(stats.last, format))}</span>`
      : ''

  return `<span class="aha-spark" data-chart="sparkline" data-chart-id="${escapeAttr(idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${svg}<span class="aha-tip" hidden="hidden"></span>${valueText}</span>`
}

/** Client stops for the shared interaction kit: one stop per value. */
export function sparklineStops(input: SparklineInput): ReadonlyArray<ChartStop> {
  const format = readFormat(input.format)
  const stats = sparkStats(input.values)

  if (stats === null) {
    return []
  }

  const out: Array<ChartStop> = []

  for (let index = 0; index < input.values.length; index += 1) {
    const value = input.values[index]

    if (value === undefined || value === null) {
      continue
    }

    const point = sparkPoint(value, index, input.values.length, stats)
    out.push({
      x: point.x,
      y: point.y,
      html: `<b>${escapeHtml(`#${String(index + 1)}`)}</b><div><span class="hv">${escapeHtml(formatNumberValue(value, format))}</span></div>`
    })
  }

  return out
}
