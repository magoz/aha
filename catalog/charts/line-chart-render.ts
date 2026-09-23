import {
  layoutFrame,
  placeSeriesLabels,
  renderAxis,
  renderAxisCaption,
  renderSeriesLabels,
  tooltipShell
} from '../shared/chart-frame.js'
import type { LabelSlot } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import {
  defaultNumberFormat,
  formatFullDate,
  formatNumberValue,
  parseTimeInput
} from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { linearTicks, logTicks, timeTicks } from '../shared/ticks.js'
import type { ChartTick } from '../shared/ticks.js'
import { isJsonNumber } from '../shared/guards.js'
import {
  coord,
  dashForSeries,
  escapeAttr,
  escapeHtml,
  linePath,
  markerForSeries,
  markerGlyph
} from '../shared/svg.js'
import type { PlotPoint } from '../shared/svg.js'
import { linearScale, logScale, timeScale, mapScale } from '../shared/scales.js'
import type { ContinuousScale } from '../shared/scales.js'
import type { LineChartInput } from './line-chart-schema.js'

/**
 * Line-chart renderer. Pure string and SVG builders shared by the Node
 * build and the browser client, which re-renders on resize.
 */

export const LINE_CHART_WIDTH = 640

export const LINE_CHART_HEIGHT = 380

export interface LineChartRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

type XKind = 'number' | 'time' | 'category'

interface ResolvedPoint {
  readonly key: string
  readonly numericX: number | null
  readonly y: number | null
}

interface ResolvedSeries {
  readonly name: string
  readonly highlight: boolean
  readonly points: ReadonlyArray<ResolvedPoint>
}

function readFormat(raw: LineChartInput['y']): NumberFormatSpec {
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

function readXFormat(input: LineChartInput): NumberFormatSpec {
  const format = input.x.format

  if (format === undefined) {
    return defaultNumberFormat()
  }

  return {
    style: format.style ?? 'decimal',
    currency: format.currency ?? null,
    digits: format.digits ?? null
  }
}

function pointKey(kind: XKind, rawX: number | string): string {
  if (kind === 'category') {
    return `c:${String(rawX)}`
  }

  if (kind === 'time') {
    const millis = parseTimeInput(rawX)

    if (millis === null) {
      return `bad:${String(rawX)}`
    }

    return `t:${String(millis)}`
  }

  if (isJsonNumber(rawX)) {
    return `n:${String(rawX)}`
  }

  return `bad:${String(rawX)}`
}

function numericXOf(kind: XKind, rawX: number | string): number | null {
  if (kind === 'category') {
    return null
  }

  if (kind === 'time') {
    return parseTimeInput(rawX)
  }

  if (isJsonNumber(rawX)) {
    return rawX
  }

  return null
}

function resolveSeries(input: LineChartInput): ReadonlyArray<ResolvedSeries> {
  const kind: XKind = input.x.kind
  const out: Array<ResolvedSeries> = []

  for (const series of input.series) {
    const points: Array<ResolvedPoint> = []

    for (const point of series.values) {
      const y = point.y === null ? null : point.y
      points.push({ key: pointKey(kind, point.x), numericX: numericXOf(kind, point.x), y })
    }

    out.push({ name: series.name, highlight: series.highlight ?? false, points })
  }

  return out
}

function categoryOrder(series: ReadonlyArray<ResolvedSeries>): ReadonlyArray<string> {
  const seen: Array<string> = []

  for (const lane of series) {
    for (const point of lane.points) {
      if (!point.key.startsWith('c:')) {
        continue
      }

      const label = point.key.slice(2)
      let found = false

      for (const known of seen) {
        if (known === label) {
          found = true
          break
        }
      }

      if (!found) {
        seen.push(label)
      }
    }
  }

  return seen
}

interface NumberDomain {
  readonly min: number
  readonly max: number
}

function numberDomain(values: ReadonlyArray<number>): NumberDomain {
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
    return { min: 0, max: 1 }
  }

  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1

    return { min: min - pad, max: max + pad }
  }

  const pad = (max - min) * 0.05

  return { min: min - pad, max: max + pad }
}

function useLogScale(requested: string | undefined, values: ReadonlyArray<number>): boolean {
  if (requested !== 'log') {
    return false
  }

  for (const value of values) {
    if (!(value > 0)) {
      return false
    }
  }

  return values.length > 0
}

export interface ChartDomain {
  readonly log: boolean
  readonly min: number
  readonly max: number
}

export function yChartDomain(
  scale: string | undefined,
  values: ReadonlyArray<number>
): ChartDomain {
  if (useLogScale(scale, values)) {
    const log = logDomainOf(values)

    if (log !== null) {
      return { log: true, min: log.min, max: log.max }
    }
  }

  const linear = numberDomain(values)

  return { log: false, min: linear.min, max: linear.max }
}

export function xChartDomain(
  kind: XKind,
  scale: string | undefined,
  values: ReadonlyArray<number>
): ChartDomain {
  if (kind === 'number' && useLogScale(scale, values)) {
    const log = logDomainOf(values)

    if (log !== null) {
      return { log: true, min: log.min, max: log.max }
    }
  }

  const linear = numberDomain(values)

  return { log: false, min: linear.min, max: linear.max }
}

/** Multiplicative padding for log domains; null when nothing is positive. */
function logDomainOf(values: ReadonlyArray<number>): NumberDomain | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const value of values) {
    if (!(value > 0)) {
      continue
    }

    if (value < min) {
      min = value
    }

    if (value > max) {
      max = value
    }
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return null
  }

  if (min === max) {
    return { min: min / 10, max: max * 10 }
  }

  return { min: min / 1.5, max: max * 1.1 }
}

function seriesClass(index: number, highlight: boolean, muted: boolean): string {
  if (highlight) {
    return 'series hi'
  }

  if (muted) {
    return `series cat-${String(index % 6)}`
  }

  return `series ls-${String(index % 4)}`
}

function stopLabel(kind: XKind, key: string, xFormat: NumberFormatSpec): string {
  if (key.startsWith('c:')) {
    return key.slice(2)
  }

  if (key.startsWith('t:')) {
    return formatFullDate(Number(key.slice(2)))
  }

  return formatNumberValue(Number(key.slice(2)), xFormat)
}

function collectStops(kind: XKind, series: ReadonlyArray<ResolvedSeries>): ReadonlyArray<string> {
  if (kind === 'category') {
    const order = categoryOrder(series)
    const out: Array<string> = []

    for (const label of order) {
      out.push(`c:${label}`)
    }

    return out
  }

  const values: Array<number> = []

  for (const lane of series) {
    for (const point of lane.points) {
      if (point.numericX === null) {
        continue
      }

      values.push(point.numericX)
    }
  }

  values.sort((left, right) => left - right)
  const out: Array<string> = []
  const prefix = kind === 'time' ? 't' : 'n'

  for (const value of values) {
    const key = `${prefix}:${String(value)}`
    const last = out[out.length - 1]

    if (last !== key) {
      out.push(key)
    }
  }

  return out
}

export function renderLineChart(input: LineChartInput, options: LineChartRenderOptions): string {
  const series = resolveSeries(input)

  if (series.length === 0) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No series</p></div>`
  }

  const kind: XKind = input.x.kind
  const muted = (input.palette ?? 'mono') === 'muted'
  const yFormat = readFormat(input.y)
  const xFormat = readXFormat(input)

  const yValues: Array<number> = []
  const xValues: Array<number> = []

  for (const lane of series) {
    for (const point of lane.points) {
      if (point.y !== null) {
        yValues.push(point.y)
      }

      if (point.numericX !== null) {
        xValues.push(point.numericX)
      }
    }
  }

  const yDomain = yChartDomain(input.y?.scale, yValues)
  const yLog = yDomain.log
  const xDomain = xChartDomain(kind, input.x.scale, xValues)
  const xLog = xDomain.log

  const width = Math.max(280, options.width)
  const height = Math.round((width * LINE_CHART_HEIGHT) / LINE_CHART_WIDTH)

  const yTicks: ReadonlyArray<ChartTick> = yLog
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
    leftGutter: Math.min(110, Math.max(44, longestTick * 7 + 14))
  })

  let xScale: ContinuousScale
  let xTicks: ReadonlyArray<ChartTick> = []
  const categories = kind === 'category' ? categoryOrder(series) : []

  if (kind === 'time') {
    xScale = timeScale({
      domainMin: xDomain.min,
      domainMax: xDomain.max,
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
    xTicks = timeTicks({ min: xDomain.min, max: xDomain.max, count: 5 })
  } else if (kind === 'number' && xLog) {
    xScale = logScale({
      domainMin: xDomain.min,
      domainMax: xDomain.max,
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
    xTicks = logTicks({ min: xDomain.min, max: xDomain.max, format: xFormat })
  } else if (kind === 'number') {
    xScale = linearScale({
      domainMin: xDomain.min,
      domainMax: xDomain.max,
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
    xTicks = linearTicks({ min: xDomain.min, max: xDomain.max, count: 5, format: xFormat })
  } else {
    xScale = linearScale({
      domainMin: -0.5,
      domainMax: Math.max(0.5, categories.length - 0.5),
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
    const stride = Math.max(1, Math.ceil(categories.length / 6))
    const sampled: Array<ChartTick> = []

    for (let index = 0; index < categories.length; index += stride) {
      const label = categories[index]

      if (label !== undefined) {
        sampled.push({ value: index, label })
      }
    }

    xTicks = sampled
  }

  const yScale: ContinuousScale = yLog
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

  const categoryIndex = new Map<string, number>()

  for (let index = 0; index < categories.length; index += 1) {
    const label = categories[index]

    if (label !== undefined) {
      categoryIndex.set(label, index)
    }
  }

  const pointPixel = (point: ResolvedPoint): PlotPoint | null => {
    if (point.y === null) {
      return null
    }

    let x = 0

    if (kind === 'category') {
      const slot = categoryIndex.get(point.key.slice(2))

      if (slot === undefined) {
        return null
      }

      x = mapScale(xScale, slot)
    } else {
      if (point.numericX === null) {
        return null
      }

      x = mapScale(xScale, point.numericX)
    }

    return { x, y: mapScale(yScale, point.y) }
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
    svg += renderAxisCaption(escapeHtml(input.y.label), layout.plotX, layout.plotY - 4, 'start')
  }

  if (input.x.label !== undefined) {
    svg += renderAxisCaption(
      escapeHtml(input.x.label),
      layout.plotX + layout.plotWidth / 2,
      layout.plotY + layout.plotHeight + 30,
      'middle'
    )
  }

  const stops = collectStops(kind, series)
  const stopIndex = new Map<string, number>()

  for (let index = 0; index < stops.length; index += 1) {
    const key = stops[index]

    if (key !== undefined) {
      stopIndex.set(key, index)
    }
  }

  const slots: Array<LabelSlot> = []
  const showMarkers = stops.length <= 40

  for (let laneIndex = 0; laneIndex < series.length; laneIndex += 1) {
    const lane = series[laneIndex]

    if (lane === undefined) {
      continue
    }

    const cls = seriesClass(laneIndex, lane.highlight, muted)
    const dash = muted ? null : dashForSeries(laneIndex, lane.highlight)
    const dashAttr = dash === null ? '' : ` stroke-dasharray="${dash}"`
    const marker = markerForSeries(laneIndex)

    svg += `<g class="${cls}" data-series="${String(laneIndex)}"${dashAttr}>`

    let segment: Array<PlotPoint> = []

    const flush = (): void => {
      if (segment.length > 1) {
        svg += `<path d="${linePath(segment)}"/>`
      } else if (segment.length === 1 && !showMarkers) {
        const only = segment[0]

        if (only !== undefined) {
          svg += markerGlyph(marker, only.x, only.y, 5)
        }
      }

      segment = []
    }

    let lastPixel: PlotPoint | null = null

    for (const point of lane.points) {
      const pixel = pointPixel(point)

      if (pixel === null) {
        flush()
        lastPixel = null
        continue
      }

      segment.push(pixel)
      lastPixel = pixel

      if (showMarkers) {
        const stop = stopIndex.get(point.key) ?? 0
        svg += `<g data-stop="${String(stop)}" data-series="${String(laneIndex)}">${markerGlyph(marker, pixel.x, pixel.y, 5)}</g>`
      }
    }

    flush()

    if (lastPixel !== null) {
      slots.push({
        seriesIndex: laneIndex,
        name: lane.name,
        x: layout.plotX + layout.plotWidth + 8,
        y: lastPixel.y
      })
    }

    svg += '</g>'
  }

  const highlighted = series.map((lane) => lane.highlight)
  svg += renderSeriesLabels({
    labels: placeSeriesLabels(slots, { minY: layout.plotY + 4, maxY: layout.height - 6 }),
    highlighted
  })
  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Exact values</summary><table><thead><tr><th>x</th>'

  for (const lane of series) {
    table += `<th class="num">${escapeHtml(lane.name)}</th>`
  }

  table += '</tr></thead><tbody>'

  for (const stop of stops) {
    table += `<tr><td>${escapeHtml(stopLabel(kind, stop, xFormat))}</td>`

    for (const lane of series) {
      let cell = '—'

      for (const point of lane.points) {
        if (point.key === stop && point.y !== null) {
          cell = formatNumberValue(point.y, yFormat)
          break
        }
      }

      table += `<td class="num">${escapeHtml(cell)}</td>`
    }

    table += '</tr>'
  }

  table += '</tbody></table></details>'

  const names = series.map((lane) => lane.name).join(', ')
  const aria = input.title === undefined ? `Line chart: ${names}` : `${input.title}: ${names}`

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-line-chart" data-chart="line-chart" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

/** Client stops for the shared interaction kit: pixel x plus tooltip html. */
export function lineChartStops(input: LineChartInput, width: number): ReadonlyArray<ChartStop> {
  const series = resolveSeries(input)

  if (series.length === 0) {
    return []
  }

  const kind: XKind = input.x.kind
  const yFormat = readFormat(input.y)
  const xFormat = readXFormat(input)
  const stops = collectStops(kind, series)
  const safeWidth = Math.max(280, width)
  const layout = layoutFrame({ width: safeWidth, height: 120, leftGutter: 60 })

  const xValues: Array<number> = []

  for (const lane of series) {
    for (const point of lane.points) {
      if (point.numericX !== null) {
        xValues.push(point.numericX)
      }
    }
  }

  const domain = numberDomain(xValues)
  const categories = kind === 'category' ? categoryOrder(series) : []
  const categoryIndex = new Map<string, number>()

  for (let index = 0; index < categories.length; index += 1) {
    const label = categories[index]

    if (label !== undefined) {
      categoryIndex.set(label, index)
    }
  }

  let xScale: ContinuousScale

  if (kind === 'time') {
    xScale = timeScale({
      domainMin: domain.min,
      domainMax: domain.max,
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  } else if (kind === 'category') {
    xScale = linearScale({
      domainMin: -0.5,
      domainMax: Math.max(0.5, categories.length - 0.5),
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  } else {
    xScale = linearScale({
      domainMin: domain.min,
      domainMax: domain.max,
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  }

  const yValues: Array<number> = []

  for (const lane of series) {
    for (const point of lane.points) {
      if (point.y !== null) {
        yValues.push(point.y)
      }
    }
  }

  const yDomain = yChartDomain(input.y?.scale, yValues)
  const yLog = yDomain.log

  const yScale: ContinuousScale = yLog
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

  for (const stop of stops) {
    let x = layout.plotX
    let y = layout.plotY + layout.plotHeight / 2
    let rows = ''
    let foundY = false

    for (const lane of series) {
      let cell = '—'

      for (const point of lane.points) {
        if (point.key !== stop || point.y === null) {
          continue
        }

        cell = formatNumberValue(point.y, yFormat)

        if (!foundY) {
          if (kind === 'category') {
            const slot = categoryIndex.get(stop.slice(2))

            if (slot !== undefined) {
              x = mapScale(xScale, slot)
            }
          } else if (point.numericX !== null) {
            x = mapScale(xScale, point.numericX)
          }

          y = mapScale(yScale, point.y)
          foundY = true
        }

        break
      }

      rows += `<div>${escapeHtml(lane.name)}: <span class="hv">${escapeHtml(cell)}</span></div>`
    }

    out.push({ x, y, html: `<b>${escapeHtml(stopLabel(kind, stop, xFormat))}</b>${rows}` })
  }

  return out
}
