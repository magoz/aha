import { layoutFrame, renderAxis, tooltipShell } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import { defaultNumberFormat, formatNumberValue } from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { linearTicks } from '../shared/ticks.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import { linearScale, mapScale } from '../shared/scales.js'
import type { RangePlotInput } from './range-plot-schema.js'

/**
 * Range-plot renderer. A dumbbell per category: before and after (or min
 * and max) with the change highlighted. Pure builders shared by the Node
 * build and the browser client.
 */

export const RANGE_PLOT_WIDTH = 640

const ROW_HEIGHT = 36

export interface RangePlotRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

function readFormat(raw: RangePlotInput['format']): NumberFormatSpec {
  if (raw === undefined) {
    return defaultNumberFormat()
  }

  return {
    style: raw.style ?? 'decimal',
    currency: raw.currency ?? null,
    digits: raw.digits ?? null
  }
}

function truncateLabel(label: string, limit: number): string {
  if (label.length <= limit) {
    return label
  }

  return `${label.slice(0, Math.max(1, limit - 1))}…`
}

function signedDelta(value: number, format: NumberFormatSpec): string {
  const text = formatNumberValue(Math.abs(value), format)

  if (value > 0) {
    return `+${text}`
  }

  if (value < 0) {
    return `−${text}`
  }

  return '±0'
}

export function renderRangePlot(input: RangePlotInput, options: RangePlotRenderOptions): string {
  if (input.rows.length === 0) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No data</p></div>`
  }

  const format = readFormat(input.format)
  const fromLabel = input.fromLabel ?? 'before'
  const toLabel = input.toLabel ?? 'after'

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let longestLabel = 0

  for (const row of input.rows) {
    if (row.a < min) {
      min = row.a
    }

    if (row.b < min) {
      min = row.b
    }

    if (row.a > max) {
      max = row.a
    }

    if (row.b > max) {
      max = row.b
    }

    if (row.label.length > longestLabel) {
      longestLabel = row.label.length
    }
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    min = 0
    max = 1
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  const pad = (max - min) * 0.12
  min -= pad
  max += pad

  const width = Math.max(280, options.width)
  const height = 40 + input.rows.length * ROW_HEIGHT + 40

  const layout = layoutFrame({
    width,
    height,
    leftGutter: Math.min(150, Math.max(52, Math.min(longestLabel, 20) * 6.5 + 14)),
    margins: { top: 16, bottom: 34, right: 76 }
  })

  const valueScale = linearScale({
    domainMin: min,
    domainMax: max,
    rangeMin: layout.plotX,
    rangeMax: layout.plotX + layout.plotWidth
  })

  const ticks = linearTicks({ min, max, count: 5, format })
  const positions: Array<number> = []

  for (const tick of ticks) {
    positions.push(mapScale(valueScale, tick.value))
  }

  let svg = `<svg viewBox="0 0 ${String(layout.width)} ${String(layout.height)}" role="presentation">`
  svg += renderAxis({
    ticks,
    positions,
    orientation: 'x',
    plotX: layout.plotX,
    plotY: layout.plotY,
    plotWidth: layout.plotWidth,
    plotHeight: layout.plotHeight
  })
  svg += `<rect x="${coord(layout.plotX)}" y="${coord(layout.plotY)}" width="${coord(layout.plotWidth)}" height="${coord(layout.plotHeight)}" class="frame"/>`

  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index]

    if (row === undefined) {
      continue
    }

    const cy = layout.plotY + ROW_HEIGHT * index + ROW_HEIGHT / 2
    const xa = mapScale(valueScale, row.a)
    const xb = mapScale(valueScale, row.b)
    const cls = (row.highlight ?? false) ? 'rng hi' : 'rng'
    const delta = row.b - row.a

    svg += `<text x="${coord(layout.plotX - 8)}" y="${coord(cy + 4)}" text-anchor="end" class="tick"><title>${escapeAttr(row.label)}</title>${escapeHtml(truncateLabel(row.label, 20))}</text>`
    svg += `<line x1="${coord(xa)}" y1="${coord(cy)}" x2="${coord(xb)}" y2="${coord(cy)}" class="${cls}" data-series="${String(index)}"/>`
    svg += `<circle cx="${coord(xa)}" cy="${coord(cy)}" r="4.5" class="${cls} open" data-stop="${String(index)}" data-series="${String(index)}"><title>${escapeAttr(`${row.label} · ${fromLabel}: ${formatNumberValue(row.a, format)}`)}</title></circle>`
    svg += `<circle cx="${coord(xb)}" cy="${coord(cy)}" r="4.5" class="${cls} shut" data-stop="${String(index)}" data-series="${String(index)}"><title>${escapeAttr(`${row.label} · ${toLabel}: ${formatNumberValue(row.b, format)}`)}</title></circle>`
    svg += `<text x="${coord(layout.plotX + layout.plotWidth + 8)}" y="${coord(cy + 4)}" text-anchor="start" class="dl${(row.highlight ?? false) ? ' hi' : ''}">${escapeHtml(signedDelta(delta, format))}</text>`
  }

  svg += '</svg>'

  let table = `<details class="aha-values"><summary>Exact values</summary><div class="aha-scroll"><table><thead><tr><th>category</th><th class="num">${escapeHtml(fromLabel)}</th><th class="num">${escapeHtml(toLabel)}</th><th class="num">change</th></tr></thead><tbody>`

  for (const row of input.rows) {
    table += `<tr><td>${escapeHtml(row.label)}</td><td class="num">${escapeHtml(formatNumberValue(row.a, format))}</td><td class="num">${escapeHtml(formatNumberValue(row.b, format))}</td><td class="num">${escapeHtml(signedDelta(row.b - row.a, format))}</td></tr>`
  }

  table += '</tbody></table></div></details>'

  const aria = input.title === undefined ? 'Range plot' : input.title

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-range" data-chart="range-plot" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

/** Client stops for the shared interaction kit: one stop per row. */
export function rangePlotStops(input: RangePlotInput, width: number): ReadonlyArray<ChartStop> {
  const format = readFormat(input.format)
  const fromLabel = input.fromLabel ?? 'before'
  const toLabel = input.toLabel ?? 'after'

  if (input.rows.length === 0) {
    return []
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const row of input.rows) {
    if (row.a < min) {
      min = row.a
    }

    if (row.b < min) {
      min = row.b
    }

    if (row.a > max) {
      max = row.a
    }

    if (row.b > max) {
      max = row.b
    }
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return []
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  const safeWidth = Math.max(280, width)
  const layout = layoutFrame({ width: safeWidth, height: 120, leftGutter: 60 })

  const valueScale = linearScale({
    domainMin: min,
    domainMax: max,
    rangeMin: layout.plotX,
    rangeMax: layout.plotX + layout.plotWidth
  })

  const out: Array<ChartStop> = []

  for (const row of input.rows) {
    out.push({
      x: (mapScale(valueScale, row.a) + mapScale(valueScale, row.b)) / 2,
      y: layout.plotY + 30,
      html: `<b>${escapeHtml(row.label)}</b><div>${escapeHtml(fromLabel)}: <span class="hv">${escapeHtml(formatNumberValue(row.a, format))}</span></div><div>${escapeHtml(toLabel)}: <span class="hv">${escapeHtml(formatNumberValue(row.b, format))}</span></div><div>change: <span class="hv">${escapeHtml(signedDelta(row.b - row.a, format))}</span></div>`
    })
  }

  return out
}
