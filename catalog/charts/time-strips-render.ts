import { layoutFrame, renderAxis, renderAxisCaption, tooltipShell } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import {
  defaultNumberFormat,
  formatDateTimeTick,
  formatFullDate,
  formatHourTick,
  formatNumberValue,
  parseTimeInput
} from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { linearTicks, timeTicks, ensureTwoTicks } from '../shared/ticks.js'
import {
  bandPath,
  coord,
  escapeAttr,
  escapeHtml,
  linePath,
  markerForSeries,
  markerGlyph
} from '../shared/svg.js'
import type { PlotPoint } from '../shared/svg.js'
import { linearScale, timeScale, mapScale } from '../shared/scales.js'
import type { TimeStripsInput } from './time-strips-schema.js'

/**
 * Time-strips renderer. Several rows share one time axis; each row keeps
 * its own small scale with a few labelled ticks. Pure builders shared by
 * the Node build and the browser client.
 */

export const TIME_STRIPS_WIDTH = 640

const ROW_HEIGHT = 84

const ROW_GAP = 22

const TOP_PAD = 26

export interface TimeStripsRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

interface ResolvedStripPoint {
  readonly t: number
  readonly v: number | null
  readonly m: number | null
  readonly lo: number | null
  readonly hi: number | null
}

interface ResolvedRow {
  readonly label: string
  readonly kind: string
  readonly unit: string | null
  readonly barUnit: string | null
  readonly blue: boolean
  readonly laneIndex: number
  readonly format: NumberFormatSpec
  readonly points: ReadonlyArray<ResolvedStripPoint>
}

function readStripFormat(raw: TimeStripsInput['rows'][number]['format']): NumberFormatSpec {
  if (raw === undefined) {
    return defaultNumberFormat()
  }

  return {
    style: raw.style ?? 'decimal',
    currency: raw.currency ?? null,
    digits: raw.digits ?? null
  }
}

function resolveRows(input: TimeStripsInput): ReadonlyArray<ResolvedRow> {
  const out: Array<ResolvedRow> = []
  let lane = 0

  for (const row of input.rows) {
    const points: Array<ResolvedStripPoint> = []

    for (const point of row.points) {
      const t = parseTimeInput(point.t)

      if (t === null) {
        continue
      }

      points.push({
        t,
        v: point.v ?? null,
        m: point.m ?? null,
        lo: point.lo ?? null,
        hi: point.hi ?? null
      })
    }

    out.push({
      label: row.label,
      kind: row.kind,
      unit: row.unit ?? null,
      barUnit: row.barUnit ?? null,
      blue: (row.lane ?? 'ink') === 'blue',
      laneIndex: lane,
      format: readStripFormat(row.format),
      points
    })
    lane += 1
  }

  return out
}

function rowLineValues(row: ResolvedRow): Array<number> {
  const out: Array<number> = []

  for (const point of row.points) {
    if (point.v !== null) {
      out.push(point.v)
    }

    if ((row.kind === 'band' || row.kind === 'line-band') && point.lo !== null) {
      out.push(point.lo)
    }

    if ((row.kind === 'band' || row.kind === 'line-band') && point.hi !== null) {
      out.push(point.hi)
    }
  }

  return out
}

function rowBarValues(row: ResolvedRow): Array<number> {
  const out: Array<number> = []

  for (const point of row.points) {
    if (point.m !== null && point.m > 0) {
      out.push(point.m)
    }
  }

  return out
}

interface RowFrame {
  readonly row: ResolvedRow
  readonly top: number
  readonly lineMin: number
  readonly lineMax: number
  readonly barMax: number
}

export function renderTimeStrips(input: TimeStripsInput, options: TimeStripsRenderOptions): string {
  const rows = resolveRows(input)

  if (rows.length === 0) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No rows</p></div>`
  }

  let axisMin = Number.POSITIVE_INFINITY
  let axisMax = Number.NEGATIVE_INFINITY

  for (const row of rows) {
    for (const point of row.points) {
      if (point.t < axisMin) {
        axisMin = point.t
      }

      if (point.t > axisMax) {
        axisMax = point.t
      }
    }
  }

  const startRaw = input.start === undefined ? null : parseTimeInput(input.start)
  const endRaw = input.end === undefined ? null : parseTimeInput(input.end)

  if (startRaw !== null) {
    axisMin = startRaw
  }

  if (endRaw !== null) {
    axisMax = endRaw
  }

  if (axisMin === Number.POSITIVE_INFINITY || axisMax === Number.NEGATIVE_INFINITY) {
    axisMin = 0
    axisMax = 1
  }

  if (axisMax <= axisMin) {
    axisMax = axisMin + 3_600_000
  }

  const width = Math.max(280, options.width)
  const height = TOP_PAD + rows.length * ROW_HEIGHT + (rows.length - 1) * ROW_GAP + 44
  const layout = layoutFrame({ width, height, leftGutter: 46 })

  const axisScale = timeScale({
    domainMin: axisMin,
    domainMax: axisMax,
    rangeMin: layout.plotX,
    rangeMax: layout.plotX + layout.plotWidth
  })

  const xTicks = timeTicks({ min: axisMin, max: axisMax, count: 5 })
  const xPositions: Array<number> = []

  for (const tick of xTicks) {
    xPositions.push(mapScale(axisScale, tick.value))
  }

  const frames: Array<RowFrame> = []
  let cursor = TOP_PAD

  for (const row of rows) {
    const line = rowLineValues(row)
    let lineMin = 0
    let lineMax = 1

    if (line.length > 0) {
      lineMin = line[0] ?? 0
      lineMax = line[0] ?? 1

      for (const value of line) {
        if (value < lineMin) {
          lineMin = value
        }

        if (value > lineMax) {
          lineMax = value
        }
      }

      if (lineMin === lineMax) {
        lineMin -= 1
        lineMax += 1
      } else {
        const pad = (lineMax - lineMin) * 0.12
        lineMin -= pad
        lineMax += pad
      }
    }

    const bars = rowBarValues(row)
    let barMax = 1

    for (const value of bars) {
      if (value > barMax) {
        barMax = value
      }
    }

    frames.push({ row, top: cursor, lineMin, lineMax, barMax })
    cursor += ROW_HEIGHT + ROW_GAP
  }

  const yOf = (frame: RowFrame, value: number): number => {
    const scale = linearScale({
      domainMin: frame.lineMin,
      domainMax: frame.lineMax,
      rangeMin: frame.top + ROW_HEIGHT,
      rangeMax: frame.top + 6
    })

    return mapScale(scale, value)
  }

  const barYOf = (frame: RowFrame, value: number): number => {
    const scale = linearScale({
      domainMin: 0,
      domainMax: frame.barMax,
      rangeMin: frame.top + ROW_HEIGHT,
      rangeMax: frame.top + 6
    })

    return mapScale(scale, value)
  }

  let svg = `<svg viewBox="0 0 ${String(width)} ${String(height)}" role="presentation">`

  for (const frame of frames) {
    const lane = frame.row.blue ? 'ts-blue' : `ls-${String(frame.row.laneIndex % 4)}`
    const marker = markerForSeries(frame.row.laneIndex)

    const hasBars =
      (frame.row.kind === 'bars' || frame.row.kind === 'line-bars') &&
      rowBarValues(frame.row).length > 0

    const ticks = ensureTwoTicks(
      linearTicks({
        min: frame.lineMin,
        max: frame.lineMax,
        count: 3,
        format: frame.row.format
      }),
      { min: frame.lineMin, max: frame.lineMax, format: frame.row.format }
    )

    const positions: Array<number> = []

    for (const tick of ticks) {
      positions.push(yOf(frame, tick.value))
    }

    svg += renderAxis({
      ticks,
      positions,
      orientation: 'y',
      plotX: layout.plotX,
      plotY: frame.top,
      plotWidth: layout.plotWidth,
      plotHeight: ROW_HEIGHT
    })

    const caption =
      frame.row.unit === null
        ? frame.row.label
        : frame.row.barUnit !== null && hasBars
          ? `${frame.row.label} · ${frame.row.unit} line (left), ${frame.row.barUnit} bars (right)`
          : `${frame.row.label} · ${frame.row.unit}`

    svg += renderAxisCaption(escapeHtml(caption), layout.plotX, frame.top - 6, 'start')

    if (frame.row.kind === 'band' || frame.row.kind === 'line-band') {
      const top: Array<PlotPoint> = []
      const bottom: Array<PlotPoint> = []

      for (const point of frame.row.points) {
        if (point.lo === null || point.hi === null) {
          continue
        }

        const x = mapScale(axisScale, point.t)
        top.push({ x, y: yOf(frame, point.hi) })
        bottom.push({ x, y: yOf(frame, point.lo) })
      }

      if (top.length > 1) {
        svg += `<path d="${bandPath(top, bottom)}" class="band ${lane}"/>`
      }
    }

    if (frame.row.kind === 'bars' || frame.row.kind === 'line-bars') {
      const count = frame.row.points.length
      const slot = count > 0 ? layout.plotWidth / count : layout.plotWidth
      const barWidth = Math.min(10, Math.max(2, slot * 0.55))

      for (let index = 0; index < frame.row.points.length; index += 1) {
        const point = frame.row.points[index]

        if (point === undefined || point.m === null || point.m <= 0) {
          continue
        }

        const x = mapScale(axisScale, point.t)
        const y = barYOf(frame, point.m)
        const stop = index
        svg += `<rect x="${coord(x - barWidth / 2)}" y="${coord(y)}" width="${coord(barWidth)}" height="${coord(frame.top + ROW_HEIGHT - y)}" class="bar ${lane}" data-stop="${String(stop)}" data-series="${String(frame.row.laneIndex)}"><title>${escapeAttr(formatNumberValue(point.m, frame.row.format))}</title></rect>`
      }
    }

    if (
      frame.row.kind === 'line' ||
      frame.row.kind === 'line-bars' ||
      frame.row.kind === 'line-band'
    ) {
      let segment: Array<PlotPoint> = []

      const flush = (seriesId: number): void => {
        if (segment.length > 1) {
          svg += `<path d="${linePath(segment)}" class="series ${lane}" data-series="${String(seriesId)}"/>`
        }

        segment = []
      }

      for (let index = 0; index < frame.row.points.length; index += 1) {
        const point = frame.row.points[index]

        if (point === undefined || point.v === null) {
          flush(frame.row.laneIndex)
          continue
        }

        segment.push({ x: mapScale(axisScale, point.t), y: yOf(frame, point.v) })
      }

      flush(frame.row.laneIndex)

      if (frame.row.points.length <= 60) {
        for (let index = 0; index < frame.row.points.length; index += 1) {
          const point = frame.row.points[index]

          if (point === undefined || point.v === null) {
            continue
          }

          const x = mapScale(axisScale, point.t)
          const y = yOf(frame, point.v)
          svg += `<g data-stop="${String(index)}" data-series="${String(frame.row.laneIndex)}">${markerGlyph(marker, x, y, 4)}</g>`
        }
      }
    }

    svg += `<line x1="${coord(layout.plotX)}" y1="${coord(frame.top + ROW_HEIGHT)}" x2="${coord(layout.plotX + layout.plotWidth)}" y2="${coord(frame.top + ROW_HEIGHT)}" class="frame"/>`

    if (hasBars && frame.row.kind === 'line-bars') {
      const barTicks = ensureTwoTicks(
        linearTicks({ min: 0, max: frame.barMax, count: 2, format: frame.row.format }),
        { min: 0, max: frame.barMax, format: frame.row.format }
      )

      const barPositions: Array<number> = []

      for (const tick of barTicks) {
        barPositions.push(barYOf(frame, tick.value))
      }

      svg += renderAxis({
        ticks: barTicks,
        positions: barPositions,
        orientation: 'y',
        side: 'right',
        grid: false,
        plotX: layout.plotX,
        plotY: frame.top,
        plotWidth: layout.plotWidth,
        plotHeight: ROW_HEIGHT
      })
    }
  }

  const axisTop = TOP_PAD + rows.length * ROW_HEIGHT + (rows.length - 1) * ROW_GAP
  svg += renderAxis({
    ticks: xTicks,
    positions: xPositions,
    orientation: 'x',
    plotX: layout.plotX,
    plotY: axisTop,
    plotWidth: layout.plotWidth,
    plotHeight: 0
  })
  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Exact values</summary><div class="aha-scroll"><table><thead><tr><th>time</th>'

  for (const frame of frames) {
    const head =
      frame.row.unit === null ? frame.row.label : `${frame.row.label} (${frame.row.unit})`

    table += `<th class="num">${escapeHtml(head)}</th>`
  }

  table += '</tr></thead><tbody>'

  const first = frames[0]

  if (first !== undefined) {
    for (const point of first.row.points) {
      table += `<tr><td>${escapeHtml(formatDateTimeTick(point.t))}</td>`

      for (const frame of frames) {
        let cell = '—'

        for (const candidate of frame.row.points) {
          if (candidate.t !== point.t) {
            continue
          }

          if (frame.row.kind === 'bars' && candidate.m !== null) {
            cell = formatNumberValue(candidate.m, frame.row.format)
          } else if (candidate.v !== null) {
            cell = formatNumberValue(candidate.v, frame.row.format)
          }

          break
        }

        table += `<td class="num">${escapeHtml(cell)}</td>`
      }

      table += '</tr>'
    }
  }

  table += '</tbody></table></div></details>'

  const names = frames.map((frame) => frame.row.label).join(', ')
  const aria = input.title === undefined ? `Time strips: ${names}` : `${input.title}: ${names}`

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-strips" data-chart="time-strips" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

/** Client stops for the shared interaction kit. */
export function timeStripsStops(input: TimeStripsInput, width: number): ReadonlyArray<ChartStop> {
  const rows = resolveRows(input)

  if (rows.length === 0) {
    return []
  }

  const first = rows[0]

  if (first === undefined) {
    return []
  }

  const safeWidth = Math.max(280, width)
  const layout = layoutFrame({ width: safeWidth, height: 120, leftGutter: 46 })

  let axisMin = Number.POSITIVE_INFINITY
  let axisMax = Number.NEGATIVE_INFINITY

  for (const row of rows) {
    for (const point of row.points) {
      if (point.t < axisMin) {
        axisMin = point.t
      }

      if (point.t > axisMax) {
        axisMax = point.t
      }
    }
  }

  if (axisMin === Number.POSITIVE_INFINITY || axisMax === Number.NEGATIVE_INFINITY) {
    return []
  }

  if (axisMax <= axisMin) {
    axisMax = axisMin + 3_600_000
  }

  const axisScale = timeScale({
    domainMin: axisMin,
    domainMax: axisMax,
    rangeMin: layout.plotX,
    rangeMax: layout.plotX + layout.plotWidth
  })

  const out: Array<ChartStop> = []

  for (const point of first.points) {
    let rowsHtml = ''

    for (const row of rows) {
      let cell = '—'

      for (const candidate of row.points) {
        if (candidate.t !== point.t) {
          continue
        }

        if (row.kind === 'bars' && candidate.m !== null) {
          cell = formatNumberValue(candidate.m, row.format)
        } else if (candidate.v !== null) {
          cell = formatNumberValue(candidate.v, row.format)
        } else if (candidate.lo !== null && candidate.hi !== null) {
          cell = `${formatNumberValue(candidate.lo, row.format)}–${formatNumberValue(candidate.hi, row.format)}`
        }

        break
      }

      const head = row.unit === null ? row.label : `${row.label} (${row.unit})`
      rowsHtml += `<div>${escapeHtml(head)}: <span class="hv">${escapeHtml(cell)}</span></div>`
    }

    out.push({
      x: mapScale(axisScale, point.t),
      y: layout.plotY + 40,
      html: `<b>${escapeHtml(formatFullDate(point.t))} ${escapeHtml(formatHourTick(point.t))}</b>${rowsHtml}`
    })
  }

  return out
}
