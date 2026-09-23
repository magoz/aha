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
import {
  defaultNumberFormat,
  formatFullDate,
  formatNumberValue,
  parseTimeInput
} from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { linearTicks, timeTicks } from '../shared/ticks.js'
import type { ChartTick } from '../shared/ticks.js'
import { isJsonNumber } from '../shared/guards.js'
import { bandPath, coord, escapeAttr, escapeHtml, linePath } from '../shared/svg.js'
import type { PlotPoint } from '../shared/svg.js'
import { linearScale, timeScale, mapScale } from '../shared/scales.js'
import type { ContinuousScale } from '../shared/scales.js'
import type { AreaChartInput } from './area-chart-schema.js'

/**
 * Area-chart renderer. Stacked or overlapping areas over a numeric or
 * time axis, with an optional 100% share mode. Pure string builders shared
 * by the Node build and the browser client.
 */

export const AREA_CHART_WIDTH = 640

export const AREA_CHART_HEIGHT = 380

export interface AreaChartRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

type XKind = 'number' | 'time'

function readFormat(raw: AreaChartInput['y']): NumberFormatSpec {
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

function numericXOf(kind: XKind, rawX: number | string): number | null {
  if (kind === 'time') {
    return parseTimeInput(rawX)
  }

  if (isJsonNumber(rawX)) {
    return rawX
  }

  return null
}

interface AreaColumn {
  readonly x: number
  readonly values: ReadonlyArray<number | null>
}

function collectColumns(input: AreaChartInput): ReadonlyArray<AreaColumn> {
  const kind: XKind = input.x.kind
  const seen: Array<number> = []

  for (const lane of input.series) {
    for (const point of lane.values) {
      const x = numericXOf(kind, point.x)

      if (x === null) {
        continue
      }

      let found = false

      for (const known of seen) {
        if (known === x) {
          found = true
          break
        }
      }

      if (!found) {
        seen.push(x)
      }
    }
  }

  seen.sort((left, right) => left - right)
  const out: Array<AreaColumn> = []

  for (const x of seen) {
    const values: Array<number | null> = []

    for (const lane of input.series) {
      let cell: number | null = null

      for (const point of lane.values) {
        if (numericXOf(kind, point.x) === x) {
          cell = point.y
          break
        }
      }

      values.push(cell)
    }

    out.push({ x, values })
  }

  return out
}

function seriesClass(index: number, highlight: boolean, muted: boolean): string {
  if (highlight) {
    return 'area hi'
  }

  if (muted) {
    return `area cat-${String(index % 6)}`
  }

  return `area s-${String(index % 4)}`
}

function stopLabel(kind: XKind, x: number): string {
  if (kind === 'time') {
    return formatFullDate(x)
  }

  return String(x)
}

export function renderAreaChart(input: AreaChartInput, options: AreaChartRenderOptions): string {
  const kind: XKind = input.x.kind
  const stacked = (input.mode ?? 'stacked') === 'stacked' || (input.percent ?? false)
  const percent = input.percent ?? false
  const muted = (input.palette ?? 'mono') === 'muted'
  const columns = collectColumns(input)

  if (input.series.length === 0 || columns.length === 0) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No data</p></div>`
  }

  let yFormat = readFormat(input.y)

  if (percent) {
    yFormat = { style: 'percent', currency: null, digits: 0 }
  }

  let yMax = 0

  if (percent) {
    yMax = 1
  } else if (stacked) {
    for (const column of columns) {
      let total = 0

      for (const value of column.values) {
        if (value !== null && value > 0) {
          total += value
        }
      }

      if (total > yMax) {
        yMax = total
      }
    }
  } else {
    for (const column of columns) {
      for (const value of column.values) {
        if (value !== null && value > yMax) {
          yMax = value
        }
      }
    }
  }

  if (yMax <= 0) {
    yMax = 1
  }

  const width = Math.max(280, options.width)
  const height = Math.round((width * AREA_CHART_HEIGHT) / AREA_CHART_WIDTH)

  const yTicks: ReadonlyArray<ChartTick> = linearTicks({
    min: 0,
    max: yMax,
    count: 4,
    format: yFormat
  })

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

  const firstX = columns[0]?.x ?? 0
  const lastX = columns[columns.length - 1]?.x ?? 1

  let xScale: ContinuousScale

  if (kind === 'time') {
    xScale = timeScale({
      domainMin: firstX,
      domainMax: Math.max(lastX, firstX + 1),
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  } else {
    xScale = linearScale({
      domainMin: firstX,
      domainMax: Math.max(lastX, firstX + 1),
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  }

  const xTicks = kind === 'time' ? timeTicks({ min: firstX, max: lastX, count: 5 }) : []
  const xPositions: Array<number> = []

  for (const tick of xTicks) {
    xPositions.push(mapScale(xScale, tick.value))
  }

  const yScale = linearScale({
    domainMin: 0,
    domainMax: yMax * 1.06,
    rangeMin: layout.plotY + layout.plotHeight,
    rangeMax: layout.plotY
  })

  const yPositions: Array<number> = []

  for (const tick of yTicks) {
    yPositions.push(mapScale(yScale, tick.value))
  }

  const baseline = mapScale(yScale, 0)
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

  if (xTicks.length > 0) {
    svg += renderAxis({
      ticks: xTicks,
      positions: xPositions,
      orientation: 'x',
      plotX: layout.plotX,
      plotY: layout.plotY,
      plotWidth: layout.plotWidth,
      plotHeight: layout.plotHeight
    })
  }

  svg += `<rect x="${coord(layout.plotX)}" y="${coord(layout.plotY)}" width="${coord(layout.plotWidth)}" height="${coord(layout.plotHeight)}" class="frame"/>`

  if (input.y?.label !== undefined) {
    svg += renderAxisCaption(escapeHtml(input.y.label), layout.plotX, layout.plotY - 10, 'start')
  }

  if (input.x.label !== undefined) {
    svg += renderAxisCaption(
      escapeHtml(input.x.label),
      layout.plotX + layout.plotWidth / 2,
      layout.plotY + layout.plotHeight + 30,
      'middle'
    )
  }

  const slots: Array<EndLabelSlot> = []
  const laneCount = input.series.length

  const stackBase: Array<Array<number>> = []
  const stackTop: Array<Array<number>> = []

  for (let lane = 0; lane < laneCount; lane += 1) {
    stackBase.push([])
    stackTop.push([])
  }

  for (const column of columns) {
    let running = 0

    for (let lane = 0; lane < laneCount; lane += 1) {
      const raw = column.values[lane] ?? null
      let share = 0

      if (percent) {
        let total = 0

        for (const value of column.values) {
          if (value !== null && value > 0) {
            total += value
          }
        }

        share = total > 0 && raw !== null && raw > 0 ? raw / total : 0
      } else {
        share = raw !== null && raw > 0 ? raw : 0
      }

      stackBase[lane]?.push(running)
      running += share
      stackTop[lane]?.push(running)
    }
  }

  for (let lane = 0; lane < laneCount; lane += 1) {
    const series = input.series[lane]

    if (series === undefined) {
      continue
    }

    const cls = seriesClass(lane, series.highlight ?? false, muted)

    if (stacked) {
      const top: Array<PlotPoint> = []
      const bottom: Array<PlotPoint> = []

      for (let stop = 0; stop < columns.length; stop += 1) {
        const column = columns[stop]

        if (column === undefined) {
          continue
        }

        const x = mapScale(xScale, column.x)
        top.push({ x, y: mapScale(yScale, stackTop[lane]?.[stop] ?? 0) })
        bottom.push({ x, y: mapScale(yScale, stackBase[lane]?.[stop] ?? 0) })
      }

      if (top.length > 1) {
        svg += `<path d="${bandPath(top, bottom)}" class="${cls}" data-series="${String(lane)}"/>`
      }

      const lastColumn = columns[columns.length - 1]
      const lastValue = stackTop[lane]?.[columns.length - 1]

      if (lastColumn !== undefined && lastValue !== undefined) {
        slots.push({
          seriesIndex: lane,
          name: series.name,
          x: mapScale(xScale, lastColumn.x),
          y: mapScale(yScale, lastValue)
        })
      }

      continue
    }

    let line: Array<PlotPoint> = []
    let lastTop: PlotPoint | null = null

    const flushLine = (): void => {
      if (line.length > 1) {
        svg += `<path d="${linePath(line)} L${coord(line[line.length - 1]?.x ?? 0)} ${coord(baseline)} L${coord(line[0]?.x ?? 0)} ${coord(baseline)} Z" class="${cls} fill" data-series="${String(lane)}"/>`
        svg += `<path d="${linePath(line)}" class="${cls}" data-series="${String(lane)}"/>`
      }

      line = []
    }

    for (const column of columns) {
      const raw = column.values[lane] ?? null

      if (raw === null) {
        flushLine()
        continue
      }

      const point = { x: mapScale(xScale, column.x), y: mapScale(yScale, raw) }
      line.push(point)
      lastTop = point
    }

    flushLine()

    if (lastTop !== null) {
      slots.push({ seriesIndex: lane, name: series.name, x: lastTop.x, y: lastTop.y })
    }
  }

  const highlighted = input.series.map((lane) => lane.highlight ?? false)
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
    '<details class="aha-values"><summary>Exact values</summary><table><thead><tr><th>x</th>'

  for (const lane of input.series) {
    table += `<th class="num">${escapeHtml(lane.name)}</th>`
  }

  table += '</tr></thead><tbody>'

  for (const column of columns) {
    table += `<tr><td>${escapeHtml(stopLabel(kind, column.x))}</td>`

    for (const value of column.values) {
      const cell = value === null ? '—' : formatNumberValue(value, readFormat(input.y))
      table += `<td class="num">${escapeHtml(cell)}</td>`
    }

    table += '</tr>'
  }

  table += '</tbody></table></details>'

  const names = input.series.map((lane) => lane.name).join(', ')
  const aria = input.title === undefined ? `Area chart: ${names}` : `${input.title}: ${names}`

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-area" data-chart="area-chart" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

/** Client stops for the shared interaction kit: one stop per x value. */
export function areaChartStops(input: AreaChartInput, width: number): ReadonlyArray<ChartStop> {
  const kind: XKind = input.x.kind
  const stacked = (input.mode ?? 'stacked') === 'stacked' || (input.percent ?? false)
  const percent = input.percent ?? false
  const columns = collectColumns(input)

  if (columns.length === 0) {
    return []
  }

  const yFormat = percent
    ? { style: 'percent' as const, currency: null, digits: 0 }
    : readFormat(input.y)

  const safeWidth = Math.max(280, width)
  const layout = layoutFrame({ width: safeWidth, height: 120, leftGutter: 60 })
  const firstX = columns[0]?.x ?? 0
  const lastX = columns[columns.length - 1]?.x ?? 1

  let xScale: ContinuousScale

  if (kind === 'time') {
    xScale = timeScale({
      domainMin: firstX,
      domainMax: Math.max(lastX, firstX + 1),
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  } else {
    xScale = linearScale({
      domainMin: firstX,
      domainMax: Math.max(lastX, firstX + 1),
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  }

  const out: Array<ChartStop> = []

  for (const column of columns) {
    let rows = ''

    for (let lane = 0; lane < input.series.length; lane += 1) {
      const series = input.series[lane]

      if (series === undefined) {
        continue
      }

      const raw = column.values[lane] ?? null
      let cell = '—'

      if (raw !== null) {
        if (percent) {
          let total = 0

          for (const value of column.values) {
            if (value !== null && value > 0) {
              total += value
            }
          }

          cell = total > 0 && raw > 0 ? formatNumberValue(raw / total, yFormat) : '—'
        } else {
          cell = formatNumberValue(raw, yFormat)
        }
      }

      rows += `<div>${escapeHtml(series.name)}: <span class="hv">${escapeHtml(cell)}</span></div>`
    }

    void stacked
    out.push({
      x: mapScale(xScale, column.x),
      y: layout.plotY + 40,
      html: `<b>${escapeHtml(stopLabel(kind, column.x))}</b>${rows}`
    })
  }

  return out
}
