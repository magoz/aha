import { tooltipShell } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import { defaultNumberFormat, formatNumberValue } from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import type { HeatmapInput } from './heatmap-schema.js'

/**
 * Heatmap renderer. A matrix of values over two categorical axes with a
 * sequential ink scale, a scale legend and per-cell tooltips. Pure
 * builders shared by the Node build and the browser client.
 */

export const HEATMAP_WIDTH = 640

const ROW_HEIGHT = 26

function readFormat(raw: HeatmapInput['format']): NumberFormatSpec {
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

interface HeatGeometry {
  readonly gridX: number
  readonly gridY: number
  readonly cellW: number
  readonly min: number
  readonly max: number
  readonly width: number
  readonly height: number
}

function heatGeometry(input: HeatmapInput, width: number): HeatGeometry | null {
  const rows = input.rows.length
  const columns = input.columns.length

  if (rows === 0 || columns === 0) {
    return null
  }

  let longestRow = 0

  for (const label of input.rows) {
    if (label.length > longestRow) {
      longestRow = label.length
    }
  }

  const gridX = Math.min(150, Math.max(52, Math.min(longestRow, 20) * 6.5 + 14))
  const gridY = 34
  const cellW = Math.max(24, (width - gridX - 14) / columns)
  const gridW = cellW * columns

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const line of input.values) {
    for (const value of line) {
      if (value === null) {
        continue
      }

      if (value < min) {
        min = value
      }

      if (value > max) {
        max = value
      }
    }
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return null
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  const fullWidth = gridX + gridW + 14
  const height = gridY + rows * ROW_HEIGHT + 52

  return { gridX, gridY, cellW, min, max, width: fullWidth, height }
}

function shadeFor(value: number | null, min: number, max: number): string {
  if (value === null) {
    return 'heat-empty'
  }

  const ratio = (value - min) / (max - min)

  if (ratio >= 0.8) {
    return 'heat-4'
  }

  if (ratio >= 0.6) {
    return 'heat-3'
  }

  if (ratio >= 0.4) {
    return 'heat-2'
  }

  if (ratio >= 0.2) {
    return 'heat-1'
  }

  return 'heat-0'
}

export function renderHeatmap(input: HeatmapInput, options: HeatmapWidthOptions): string {
  const format = readFormat(input.format)
  const width = Math.max(280, options.width)
  const geometry = heatGeometry(input, width)

  if (geometry === null) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No data</p></div>`
  }

  const { gridX, gridY, cellW, min, max } = geometry
  const ratio = (value: number): number => (value - min) / (max - min)

  let svg = `<svg viewBox="0 0 ${String(geometry.width)} ${String(geometry.height)}" role="presentation">`

  for (let column = 0; column < input.columns.length; column += 1) {
    const label = input.columns[column] ?? ''
    const cx = gridX + cellW * column + cellW / 2
    svg += `<text x="${coord(cx)}" y="${coord(gridY - 10)}" text-anchor="middle" class="tick"><title>${escapeAttr(label)}</title>${escapeHtml(truncateLabel(label, 10))}</text>`
  }

  for (let row = 0; row < input.rows.length; row += 1) {
    const label = input.rows[row] ?? ''
    const cy = gridY + ROW_HEIGHT * row + ROW_HEIGHT / 2 + 4
    svg += `<text x="${coord(gridX - 8)}" y="${coord(cy)}" text-anchor="end" class="tick"><title>${escapeAttr(label)}</title>${escapeHtml(truncateLabel(label, 18))}</text>`

    const line = input.values[row]

    for (let column = 0; column < input.columns.length; column += 1) {
      const value = line?.[column]
      const x = gridX + cellW * column + 1
      const y = gridY + ROW_HEIGHT * row + 1
      const stop = row * input.columns.length + column
      const cls = shadeFor(value ?? null, min, max)

      const titleText =
        value === undefined || value === null
          ? `${label} · ${input.columns[column] ?? ''}: no data`
          : `${label} · ${input.columns[column] ?? ''}: ${formatNumberValue(value, format)}`

      svg += `<rect x="${coord(x)}" y="${coord(y)}" width="${coord(cellW - 2)}" height="${coord(ROW_HEIGHT - 2)}" class="${cls}" data-stop="${String(stop)}" data-series="0"><title>${escapeAttr(titleText)}</title></rect>`

      if (value !== undefined && value !== null && cellW >= 40) {
        const dark = ratio(value) > 0.55
        const tx = gridX + cellW * column + cellW / 2
        const ty = gridY + ROW_HEIGHT * row + ROW_HEIGHT / 2 + 4
        svg += `<text x="${coord(tx)}" y="${coord(ty)}" text-anchor="middle" class="hval${dark ? ' inv' : ''}">${escapeHtml(formatNumberValue(value, format))}</text>`
      }
    }
  }

  const legendY = gridY + input.rows.length * ROW_HEIGHT + 22
  const legendX = gridX
  const swatchW = Math.min(48, (geometry.width - gridX - 100) / 5)

  for (let level = 0; level < 5; level += 1) {
    svg += `<rect x="${coord(legendX + swatchW * level)}" y="${coord(legendY)}" width="${coord(swatchW)}" height="10" class="heat-${String(level)}"/>`
  }

  svg += `<text x="${coord(legendX)}" y="${coord(legendY + 24)}" text-anchor="start" class="tick">${escapeHtml(formatNumberValue(min, format))}</text>`
  svg += `<text x="${coord(legendX + swatchW * 5)}" y="${coord(legendY + 24)}" text-anchor="end" class="tick">${escapeHtml(formatNumberValue(max, format))}</text>`
  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Exact values</summary><table><thead><tr><th></th>'

  for (const column of input.columns) {
    table += `<th class="num">${escapeHtml(column)}</th>`
  }

  table += '</tr></thead><tbody>'

  for (let row = 0; row < input.rows.length; row += 1) {
    table += `<tr><td>${escapeHtml(input.rows[row] ?? '')}</td>`
    const line = input.values[row]

    for (let column = 0; column < input.columns.length; column += 1) {
      const value = line?.[column]
      const cell = value === undefined || value === null ? '—' : formatNumberValue(value, format)
      table += `<td class="num">${escapeHtml(cell)}</td>`
    }

    table += '</tr>'
  }

  table += '</tbody></table></details>'

  const aria = input.title === undefined ? 'Heatmap' : input.title

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-heat" data-chart="heatmap" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

export interface HeatmapWidthOptions {
  readonly width: number
  readonly idPrefix: string
}

/** Client stops for the shared interaction kit: one stop per cell. */
export function heatmapStops(input: HeatmapInput, width: number): ReadonlyArray<ChartStop> {
  const format = readFormat(input.format)
  const geometry = heatGeometry(input, Math.max(280, width))

  if (geometry === null) {
    return []
  }

  const out: Array<ChartStop> = []

  for (let row = 0; row < input.rows.length; row += 1) {
    const line = input.values[row]

    for (let column = 0; column < input.columns.length; column += 1) {
      const value = line?.[column]

      const cell =
        value === undefined || value === null ? 'no data' : formatNumberValue(value, format)

      out.push({
        x: geometry.gridX + geometry.cellW * column + geometry.cellW / 2,
        y: geometry.gridY + ROW_HEIGHT * row + ROW_HEIGHT / 2,
        html: `<b>${escapeHtml(input.rows[row] ?? '')} · ${escapeHtml(input.columns[column] ?? '')}</b><div><span class="hv">${escapeHtml(cell)}</span></div>`
      })
    }
  }

  return out
}
