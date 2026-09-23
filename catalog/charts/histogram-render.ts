import { layoutFrame, renderAxis, renderAxisCaption, tooltipShell } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import { defaultNumberFormat, formatNumberValue } from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { linearTicks } from '../shared/ticks.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import { linearScale, mapScale } from '../shared/scales.js'
import type { HistogramInput } from './histogram-schema.js'

/**
 * Histogram renderer. Binned distribution with automatic nice bins and an
 * optional marker line, e.g. the median. Pure builders shared by the Node
 * build and the browser client.
 */

export const HISTOGRAM_WIDTH = 640

export const HISTOGRAM_HEIGHT = 360

export interface HistogramRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

function readFormat(raw: HistogramInput['format']): NumberFormatSpec {
  if (raw === undefined) {
    return defaultNumberFormat()
  }

  return {
    style: raw.style ?? 'decimal',
    currency: raw.currency ?? null,
    digits: raw.digits ?? null
  }
}

function niceStep(span: number, target: number): number {
  const raw = span / Math.max(1, target)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const scaled = raw / magnitude

  if (scaled >= 5) {
    return 10 * magnitude
  }

  if (scaled >= 2) {
    return 5 * magnitude
  }

  if (scaled >= 1) {
    return 2 * magnitude
  }

  return magnitude
}

export interface HistogramBin {
  readonly lo: number
  readonly hi: number
  readonly count: number
}

export function histogramBins(
  values: ReadonlyArray<number>,
  target: number | null
): ReadonlyArray<HistogramBin> {
  if (values.length === 0) {
    return []
  }

  let min = values[0] ?? 0
  let max = values[0] ?? 0

  for (const value of values) {
    if (value < min) {
      min = value
    }

    if (value > max) {
      max = value
    }
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  const auto = Math.min(12, Math.max(4, Math.ceil(Math.log2(values.length)) + 1))
  const step = niceStep(max - min, target ?? auto)
  const start = Math.floor(min / step) * step
  const bins: Array<HistogramBin> = []

  for (let edge = start; edge < max; edge += step) {
    bins.push({ lo: edge, hi: edge + step, count: 0 })
  }

  if (bins.length === 0) {
    bins.push({ lo: start, hi: start + step, count: 0 })
  }

  const counts: Array<number> = []

  for (const _bin of bins) {
    counts.push(0)
  }

  for (const value of values) {
    let slot = Math.floor((value - start) / step)

    if (slot < 0) {
      slot = 0
    }

    if (slot >= bins.length) {
      slot = bins.length - 1
    }

    counts[slot] = (counts[slot] ?? 0) + 1
  }

  const out: Array<HistogramBin> = []

  for (let index = 0; index < bins.length; index += 1) {
    const bin = bins[index]

    if (bin !== undefined) {
      out.push({ lo: bin.lo, hi: bin.hi, count: counts[index] ?? 0 })
    }
  }

  return out
}

export function renderHistogram(input: HistogramInput, options: HistogramRenderOptions): string {
  const format = readFormat(input.format)
  const bins = histogramBins(input.values, input.bins ?? null)

  if (bins.length === 0) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No data</p></div>`
  }

  let maxCount = 0

  for (const bin of bins) {
    if (bin.count > maxCount) {
      maxCount = bin.count
    }
  }

  if (maxCount === 0) {
    maxCount = 1
  }

  const firstEdge = bins[0]?.lo ?? 0
  const lastEdge = bins[bins.length - 1]?.hi ?? 1
  const width = Math.max(280, options.width)
  const height = Math.round((width * HISTOGRAM_HEIGHT) / HISTOGRAM_WIDTH)
  const layout = layoutFrame({ width, height, leftGutter: 48, margins: { top: 26 } })

  const xScale = linearScale({
    domainMin: firstEdge,
    domainMax: lastEdge,
    rangeMin: layout.plotX,
    rangeMax: layout.plotX + layout.plotWidth
  })

  const yScale = linearScale({
    domainMin: 0,
    domainMax: maxCount * 1.08,
    rangeMin: layout.plotY + layout.plotHeight,
    rangeMax: layout.plotY
  })

  const xTicks = linearTicks({ min: firstEdge, max: lastEdge, count: 5, format })
  const xPositions: Array<number> = []

  for (const tick of xTicks) {
    xPositions.push(mapScale(xScale, tick.value))
  }

  const countFormat: NumberFormatSpec = { style: 'decimal', currency: null, digits: 0 }
  const yTicks = linearTicks({ min: 0, max: maxCount, count: 4, format: countFormat })
  const yPositions: Array<number> = []

  for (const tick of yTicks) {
    yPositions.push(mapScale(yScale, tick.value))
  }

  const zeroY = mapScale(yScale, 0)
  let svg = `<svg viewBox="0 0 ${String(layout.width)} ${String(layout.height)}" role="presentation">`
  svg += renderAxis({
    ticks: yTicks,
    positions: yPositions,
    orientation: 'y',
    plotX: layout.plotX,
    plotY: layout.plotY,
    plotWidth: layout.plotWidth,
    plotHeight: layout.plotHeight
  })
  svg += renderAxis({
    ticks: xTicks,
    positions: xPositions,
    orientation: 'x',
    plotX: layout.plotX,
    plotY: layout.plotY,
    plotWidth: layout.plotWidth,
    plotHeight: layout.plotHeight
  })
  svg += `<rect x="${coord(layout.plotX)}" y="${coord(layout.plotY)}" width="${coord(layout.plotWidth)}" height="${coord(layout.plotHeight)}" class="frame"/>`

  if (input.label !== undefined) {
    svg += renderAxisCaption(
      escapeHtml(input.label),
      layout.plotX + layout.plotWidth / 2,
      layout.plotY + layout.plotHeight + 30,
      'middle'
    )
  }

  for (let index = 0; index < bins.length; index += 1) {
    const bin = bins[index]

    if (bin === undefined) {
      continue
    }

    const x0 = mapScale(xScale, bin.lo)
    const x1 = mapScale(xScale, bin.hi)
    const y = mapScale(yScale, bin.count)
    const titleText = `${formatNumberValue(bin.lo, format)}–${formatNumberValue(bin.hi, format)}: ${String(bin.count)}`
    svg += `<rect x="${coord(x0 + 0.5)}" y="${coord(y)}" width="${coord(Math.max(1, x1 - x0 - 1))}" height="${coord(Math.max(0.5, zeroY - y))}" class="bar s-0" data-stop="${String(index)}" data-series="0"><title>${escapeAttr(titleText)}</title></rect>`
  }

  if (input.marker !== undefined) {
    const markerX = mapScale(xScale, input.marker.value)
    const caption = input.marker.label ?? formatNumberValue(input.marker.value, format)
    svg += `<line x1="${coord(markerX)}" y1="${coord(layout.plotY)}" x2="${coord(markerX)}" y2="${coord(zeroY)}" class="mark"/>`
    svg += `<text x="${coord(Math.min(markerX + 6, layout.plotX + layout.plotWidth - 4))}" y="${coord(layout.plotY + 4)}" text-anchor="start" class="mlab">${escapeHtml(caption)}</text>`
  }

  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Exact values</summary><table><thead><tr><th>bin</th><th class="num">count</th></tr></thead><tbody>'

  for (const bin of bins) {
    table += `<tr><td>${escapeHtml(formatNumberValue(bin.lo, format))}–${escapeHtml(formatNumberValue(bin.hi, format))}</td><td class="num">${escapeHtml(String(bin.count))}</td></tr>`
  }

  table += '</tbody></table></details>'

  const aria = input.title === undefined ? 'Histogram' : input.title

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-hist" data-chart="histogram" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

/** Client stops for the shared interaction kit: one stop per bin. */
export function histogramStops(input: HistogramInput, _width: number): ReadonlyArray<ChartStop> {
  void _width
  const format = readFormat(input.format)
  const bins = histogramBins(input.values, input.bins ?? null)

  if (bins.length === 0) {
    return []
  }

  const firstEdge = bins[0]?.lo ?? 0
  const lastEdge = bins[bins.length - 1]?.hi ?? 1
  const layout = layoutFrame({ width: 640, height: 120, leftGutter: 48 })

  const xScale = linearScale({
    domainMin: firstEdge,
    domainMax: lastEdge,
    rangeMin: layout.plotX,
    rangeMax: layout.plotX + layout.plotWidth
  })

  const out: Array<ChartStop> = []

  for (const bin of bins) {
    out.push({
      x: (mapScale(xScale, bin.lo) + mapScale(xScale, bin.hi)) / 2,
      y: layout.plotY + 30,
      html: `<b>${escapeHtml(formatNumberValue(bin.lo, format))}–${escapeHtml(formatNumberValue(bin.hi, format))}</b><div>count: <span class="hv">${escapeHtml(String(bin.count))}</span></div>`
    })
  }

  return out
}
