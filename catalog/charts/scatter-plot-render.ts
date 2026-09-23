import {
  layoutFrame,
  placeEndLabels,
  renderAxis,
  renderAxisCaption,
  renderEndLabels,
  tooltipShell
} from '../shared/chart-frame.js'
import type { EndLabelSlot } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import { defaultNumberFormat, formatNumberValue } from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { linearTicks, logTicks } from '../shared/ticks.js'
import type { ChartTick } from '../shared/ticks.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import { linearScale, logScale, mapScale } from '../shared/scales.js'
import type { ContinuousScale } from '../shared/scales.js'
import type { ScatterPlotInput } from './scatter-plot-schema.js'

/**
 * Scatter-plot renderer. X/y points with optional size and group
 * encodings, direct labels on selected points, an optional least squares
 * trend line, and log axes. Pure builders shared by Node and the browser.
 */

export const SCATTER_PLOT_WIDTH = 640

export const SCATTER_PLOT_HEIGHT = 380

export interface ScatterPlotRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

function readFormat(raw: ScatterPlotInput['x']): NumberFormatSpec {
  const format = raw?.format

  if (format === undefined) {
    return defaultNumberFormat()
  }

  return {
    style: format.style ?? 'decimal',
    currency: format.currency ?? null,
    digits: format.digits ?? null
  }
}

interface ScatterDot {
  readonly x: number
  readonly y: number
  readonly label: string | null
  readonly group: string | null
  readonly size: number | null
  readonly lane: number
}

interface ScatterDomain {
  readonly log: boolean
  readonly min: number
  readonly max: number
}

function scatterDomain(scale: string | undefined, values: ReadonlyArray<number>): ScatterDomain {
  const positives: Array<number> = []

  for (const value of values) {
    if (value > 0) {
      positives.push(value)
    }
  }

  if (scale === 'log' && positives.length === values.length && values.length > 0) {
    let min = positives[0] ?? 1
    let max = positives[0] ?? 1

    for (const value of positives) {
      if (value < min) {
        min = value
      }

      if (value > max) {
        max = value
      }
    }

    if (min === max) {
      return { log: true, min: min / 10, max: max * 10 }
    }

    return { log: true, min: min / 1.5, max: max * 1.1 }
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const value of values) {
    if (value < min) {
      min = value
    }

    if (value > max) {
      max = value
    }
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return { log: false, min: 0, max: 1 }
  }

  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1

    return { log: false, min: min - pad, max: max + pad }
  }

  const pad = (max - min) * 0.06

  return { log: false, min: min - pad, max: max + pad }
}

function dotClass(lane: number, muted: boolean): string {
  if (muted) {
    return `dot cat-${String(lane % 6)}`
  }

  return `dot s-${String(lane % 4)}`
}

function dotRadius(size: number | null, minSize: number, maxSize: number): number {
  if (size === null || maxSize <= minSize) {
    return 3.5
  }

  return 2.5 + (4.5 * (size - minSize)) / (maxSize - minSize)
}

interface TrendLine {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

function leastSquares(
  dots: ReadonlyArray<ScatterDot>,
  xLog: boolean,
  yLog: boolean
): TrendLine | null {
  let n = 0
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY

  for (const dot of dots) {
    const fx = xLog ? Math.log10(dot.x) : dot.x
    const fy = yLog ? Math.log10(dot.y) : dot.y

    if (!Number.isFinite(fx) || !Number.isFinite(fy)) {
      continue
    }

    n += 1
    sumX += fx
    sumY += fy
    sumXY += fx * fy
    sumXX += fx * fx

    if (dot.x < minX) {
      minX = dot.x
    }

    if (dot.x > maxX) {
      maxX = dot.x
    }
  }

  if (n < 2) {
    return null
  }

  const denom = n * sumXX - sumX * sumX

  if (denom === 0) {
    return null
  }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  const project = (x: number): number => {
    const fx = xLog ? Math.log10(x) : x
    const fy = slope * fx + intercept

    return yLog ? 10 ** fy : fy
  }

  return { x1: minX, y1: project(minX), x2: maxX, y2: project(maxX) }
}

export function renderScatterPlot(
  input: ScatterPlotInput,
  options: ScatterPlotRenderOptions
): string {
  const muted = (input.palette ?? 'mono') === 'muted'
  const xFormat = readFormat(input.x)
  const yFormat = readFormat(input.y)
  const groups: Array<string> = []
  const dots: Array<ScatterDot> = []

  for (const point of input.points) {
    if (point.y === null) {
      continue
    }

    let lane = 0

    if (point.group !== undefined) {
      let found = -1

      for (let index = 0; index < groups.length; index += 1) {
        if (groups[index] === point.group) {
          found = index
          break
        }
      }

      if (found < 0) {
        groups.push(point.group)
        found = groups.length - 1
      }

      lane = found
    }

    dots.push({
      x: point.x,
      y: point.y,
      label: point.label ?? null,
      group: point.group ?? null,
      size: point.size ?? null,
      lane
    })
  }

  if (dots.length === 0) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No data</p></div>`
  }

  const xs: Array<number> = []
  const ys: Array<number> = []

  for (const dot of dots) {
    xs.push(dot.x)
    ys.push(dot.y)
  }

  const xDomain = scatterDomain(input.x?.scale, xs)
  const yDomain = scatterDomain(input.y?.scale, ys)

  const width = Math.max(280, options.width)
  const height = Math.round((width * SCATTER_PLOT_HEIGHT) / SCATTER_PLOT_WIDTH)

  const xTicks: ReadonlyArray<ChartTick> = xDomain.log
    ? logTicks({ min: xDomain.min, max: xDomain.max, format: xFormat })
    : linearTicks({ min: xDomain.min, max: xDomain.max, count: 5, format: xFormat })

  const yTicks: ReadonlyArray<ChartTick> = yDomain.log
    ? logTicks({ min: yDomain.min, max: yDomain.max, format: yFormat })
    : linearTicks({ min: yDomain.min, max: yDomain.max, count: 4, format: yFormat })

  let longestTick = 0

  for (const tick of yTicks) {
    if (tick.label.length > longestTick) {
      longestTick = tick.label.length
    }
  }

  const layout = layoutFrame({
    width,
    height,
    leftGutter: Math.min(110, Math.max(44, longestTick * 7 + 14)),
    margins: { top: 26 }
  })

  const xScale: ContinuousScale = xDomain.log
    ? logScale({
        domainMin: xDomain.min,
        domainMax: xDomain.max,
        rangeMin: layout.plotX,
        rangeMax: layout.plotX + layout.plotWidth
      })
    : linearScale({
        domainMin: xDomain.min,
        domainMax: xDomain.max,
        rangeMin: layout.plotX,
        rangeMax: layout.plotX + layout.plotWidth
      })

  const yScale: ContinuousScale = yDomain.log
    ? logScale({
        domainMin: yDomain.min,
        domainMax: yDomain.max,
        rangeMin: layout.plotY + layout.plotHeight,
        rangeMax: layout.plotY
      })
    : linearScale({
        domainMin: yDomain.min,
        domainMax: yDomain.max,
        rangeMin: layout.plotY + layout.plotHeight,
        rangeMax: layout.plotY
      })

  const xPositions: Array<number> = []

  for (const tick of xTicks) {
    xPositions.push(mapScale(xScale, tick.value))
  }

  const yPositions: Array<number> = []

  for (const tick of yTicks) {
    yPositions.push(mapScale(yScale, tick.value))
  }

  let minSize = Number.POSITIVE_INFINITY
  let maxSize = Number.NEGATIVE_INFINITY

  for (const dot of dots) {
    if (dot.size !== null) {
      if (dot.size < minSize) {
        minSize = dot.size
      }

      if (dot.size > maxSize) {
        maxSize = dot.size
      }
    }
  }

  if (minSize === Number.POSITIVE_INFINITY || maxSize === Number.NEGATIVE_INFINITY) {
    minSize = 0
    maxSize = 0
  }

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

  if (input.y?.label !== undefined) {
    svg += renderAxisCaption(escapeHtml(input.y.label), layout.plotX, layout.plotY - 10, 'start')
  }

  if (input.x?.label !== undefined) {
    svg += renderAxisCaption(
      escapeHtml(input.x.label),
      layout.plotX + layout.plotWidth / 2,
      layout.plotY + layout.plotHeight + 30,
      'middle'
    )
  }

  if (input.trend ?? false) {
    const trend = leastSquares(dots, xDomain.log, yDomain.log)

    if (trend !== null) {
      const x1 = mapScale(xScale, trend.x1)
      const y1 = mapScale(yScale, trend.y1)
      const x2 = mapScale(xScale, trend.x2)
      const y2 = mapScale(yScale, trend.y2)
      svg += `<line x1="${coord(x1)}" y1="${coord(y1)}" x2="${coord(x2)}" y2="${coord(y2)}" class="trend"/>`
    }
  }

  for (let index = 0; index < dots.length; index += 1) {
    const dot = dots[index]

    if (dot === undefined) {
      continue
    }

    const cx = mapScale(xScale, dot.x)
    const cy = mapScale(yScale, dot.y)
    const radius = dotRadius(dot.size, minSize, maxSize)
    svg += `<circle cx="${coord(cx)}" cy="${coord(cy)}" r="${coord(radius)}" class="${dotClass(dot.lane, muted)}" data-stop="${String(index)}" data-series="${String(dot.lane)}"><title>${escapeAttr(dotLabel(dot, xFormat, yFormat))}</title></circle>`
  }

  const slots: Array<EndLabelSlot> = []
  const seenGroups: Array<string> = []

  for (const dot of dots) {
    if (dot.group !== null) {
      let seen = false

      for (const known of seenGroups) {
        if (known === dot.group) {
          seen = true
          break
        }
      }

      if (!seen) {
        seenGroups.push(dot.group)

        let rightmost = dot

        for (const candidate of dots) {
          if (candidate.group === dot.group && candidate.x > rightmost.x) {
            rightmost = candidate
          }
        }

        slots.push({
          seriesIndex: rightmost.lane,
          name: rightmost.group ?? '',
          x: mapScale(xScale, rightmost.x),
          y: mapScale(yScale, rightmost.y)
        })
      }
    }

    if (dot.label !== null) {
      slots.push({
        seriesIndex: dot.lane,
        name: dot.label,
        x: mapScale(xScale, dot.x),
        y: mapScale(yScale, dot.y)
      })
    }
  }

  const highlighted: Array<boolean> = []

  for (let index = 0; index < Math.max(groups.length, 1); index += 1) {
    highlighted.push(false)
  }

  svg += renderEndLabels({
    labels: placeEndLabels(slots, {
      minY: layout.plotY + 4,
      maxY: layout.height - 6,
      maxX: layout.width - 2
    }),
    highlighted
  })
  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Exact values</summary><div class="aha-scroll"><table><thead><tr><th>x</th><th class="num">y</th><th>label</th><th>group</th></tr></thead><tbody>'

  for (const dot of dots) {
    table += `<tr><td>${escapeHtml(formatNumberValue(dot.x, xFormat))}</td><td class="num">${escapeHtml(formatNumberValue(dot.y, yFormat))}</td><td>${escapeHtml(dot.label ?? '—')}</td><td>${escapeHtml(dot.group ?? '—')}</td></tr>`
  }

  table += '</tbody></table></div></details>'

  const aria =
    input.title === undefined ? `Scatter plot: ${String(dots.length)} points` : input.title

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-scatter" data-chart="scatter-plot" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

function dotLabel(dot: ScatterDot, xFormat: NumberFormatSpec, yFormat: NumberFormatSpec): string {
  const coords = `${formatNumberValue(dot.x, xFormat)}, ${formatNumberValue(dot.y, yFormat)}`

  if (dot.label !== null) {
    return `${dot.label}: ${coords}`
  }

  if (dot.group !== null) {
    return `${dot.group}: ${coords}`
  }

  return coords
}

/** Client stops for the shared interaction kit: one stop per point. */
export function scatterPlotStops(input: ScatterPlotInput, width: number): ReadonlyArray<ChartStop> {
  const xFormat = readFormat(input.x)
  const yFormat = readFormat(input.y)
  const safeWidth = Math.max(280, width)
  const layout = layoutFrame({ width: safeWidth, height: 120, leftGutter: 60 })

  const xs: Array<number> = []
  const ys: Array<number> = []

  for (const point of input.points) {
    if (point.y !== null) {
      xs.push(point.x)
      ys.push(point.y)
    }
  }

  if (xs.length === 0) {
    return []
  }

  const xDomain = scatterDomain(input.x?.scale, xs)
  const yDomain = scatterDomain(input.y?.scale, ys)

  const xScale: ContinuousScale = xDomain.log
    ? logScale({
        domainMin: xDomain.min,
        domainMax: xDomain.max,
        rangeMin: layout.plotX,
        rangeMax: layout.plotX + layout.plotWidth
      })
    : linearScale({
        domainMin: xDomain.min,
        domainMax: xDomain.max,
        rangeMin: layout.plotX,
        rangeMax: layout.plotX + layout.plotWidth
      })

  const yScale: ContinuousScale = yDomain.log
    ? logScale({
        domainMin: yDomain.min,
        domainMax: yDomain.max,
        rangeMin: layout.plotY + layout.plotHeight,
        rangeMax: layout.plotY
      })
    : linearScale({
        domainMin: yDomain.min,
        domainMax: yDomain.max,
        rangeMin: layout.plotY + layout.plotHeight,
        rangeMax: layout.plotY
      })

  const out: Array<ChartStop> = []

  for (const point of input.points) {
    if (point.y === null) {
      continue
    }

    const head = point.label ?? point.group ?? 'point'
    out.push({
      x: mapScale(xScale, point.x),
      y: mapScale(yScale, point.y),
      html: `<b>${escapeHtml(head)}</b><div>x: <span class="hv">${escapeHtml(formatNumberValue(point.x, xFormat))}</span></div><div>y: <span class="hv">${escapeHtml(formatNumberValue(point.y, yFormat))}</span></div>`
    })
  }

  return out
}
