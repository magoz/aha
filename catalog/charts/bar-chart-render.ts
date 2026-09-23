import { layoutFrame, renderAxis, tooltipShell } from '../shared/chart-frame.js'
import type { FrameLayout } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import { defaultNumberFormat, formatNumberValue } from '../shared/format.js'
import type { NumberFormatSpec } from '../shared/format.js'
import { linearTicks } from '../shared/ticks.js'
import type { ChartTick } from '../shared/ticks.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import { linearScale, mapScale } from '../shared/scales.js'
import type { ContinuousScale } from '../shared/scales.js'
import type { BarChartInput } from './bar-chart-schema.js'

/**
 * Bar-chart renderer. Vertical or horizontal, grouped or stacked, with
 * negatives diverging from zero. Pure string builders shared by the Node
 * build and the browser client.
 */

export const BAR_CHART_WIDTH = 640

export const BAR_CHART_HEIGHT = 380

export interface BarChartRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

function readFormat(raw: BarChartInput['format']): NumberFormatSpec {
  if (raw === undefined) {
    return defaultNumberFormat()
  }

  return {
    style: raw.style ?? 'decimal',
    currency: raw.currency ?? null,
    digits: raw.digits ?? null
  }
}

function seriesClass(index: number, highlight: boolean, muted: boolean): string {
  if (highlight) {
    return 'bar hi'
  }

  if (muted) {
    return `bar cat-${String(index % 6)}`
  }

  return `bar s-${String(index % 4)}`
}

function categoryTotal(series: BarChartInput['series'], category: number): number {
  let total = 0

  for (const lane of series) {
    const value = lane.values[category]

    if (value !== undefined && value !== null) {
      total += value
    }
  }

  return total
}

function categoryOrder(input: BarChartInput): ReadonlyArray<number> {
  const order: Array<number> = []

  for (let index = 0; index < input.categories.length; index += 1) {
    order.push(index)
  }

  const sorted = input.sorted ?? 'none'

  if (sorted === 'none') {
    return order
  }

  const totals: Array<number> = []

  for (const index of order) {
    totals.push(categoryTotal(input.series, index))
  }

  order.sort((left, right) => {
    const diff = (totals[left] ?? 0) - (totals[right] ?? 0)

    return sorted === 'asc' ? diff : -diff
  })

  return order
}

interface ValueDomain {
  readonly min: number
  readonly max: number
}

function valueDomain(input: BarChartInput, stacked: boolean): ValueDomain {
  let min = 0
  let max = 0

  if (stacked) {
    for (let category = 0; category < input.categories.length; category += 1) {
      let positive = 0
      let negative = 0

      for (const lane of input.series) {
        const value = lane.values[category]

        if (value === undefined || value === null) {
          continue
        }

        if (value >= 0) {
          positive += value
        } else {
          negative += value
        }
      }

      if (positive > max) {
        max = positive
      }

      if (negative < min) {
        min = negative
      }
    }
  } else {
    for (const lane of input.series) {
      for (const value of lane.values) {
        if (value === null) {
          continue
        }

        if (value > max) {
          max = value
        }

        if (value < min) {
          min = value
        }
      }
    }
  }

  if (min === max) {
    return { min: min - 1, max: max + 1 }
  }

  const pad = (max - min) * 0.06

  return { min: min - pad, max: max + pad }
}

function truncateLabel(label: string, limit: number): string {
  if (label.length <= limit) {
    return label
  }

  return `${label.slice(0, Math.max(1, limit - 1))}…`
}

function wrapLabel(label: string): ReadonlyArray<string> {
  if (label.length <= 12) {
    return [label]
  }

  const words = label.split(' ')

  if (words.length < 2) {
    return [truncateLabel(label, 12)]
  }

  const first: Array<string> = []
  const rest: Array<string> = []
  let firstLen = 0
  let splitting = true

  for (const word of words) {
    if (splitting && firstLen + word.length <= 12) {
      first.push(word)
      firstLen += word.length + 1
      continue
    }

    splitting = false
    rest.push(word)
  }

  const second = rest.join(' ')

  if (second.length === 0) {
    return [first.join(' ')]
  }

  return [first.join(' '), truncateLabel(second, 14)]
}

interface BarRect {
  readonly category: number
  readonly lane: number
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly value: number
}

interface BarGeometry {
  readonly layout: FrameLayout
  readonly valueScale: ContinuousScale
  readonly zero: number
  readonly bars: ReadonlyArray<BarRect>
  readonly order: ReadonlyArray<number>
  readonly domain: ValueDomain
}

function layoutBars(input: BarChartInput, width: number): BarGeometry | null {
  const horizontal = (input.orientation ?? 'vertical') === 'horizontal'
  const stacked = (input.mode ?? 'grouped') === 'stacked'
  const order = categoryOrder(input)
  const laneCount = input.series.length

  if (order.length === 0 || laneCount === 0) {
    return null
  }

  const domain = valueDomain(input, stacked)
  let height = Math.round((width * BAR_CHART_HEIGHT) / BAR_CHART_WIDTH)
  let leftGutter = 48
  let bottomMargin = 48

  if (horizontal) {
    height = Math.min(560, Math.max(220, 60 + order.length * 40))
    let longestCat = 0

    for (const index of order) {
      const label = input.categories[index] ?? ''

      if (label.length > longestCat) {
        longestCat = label.length
      }
    }

    leftGutter = Math.min(150, Math.max(48, Math.min(longestCat, 20) * 6.5 + 14))
    bottomMargin = 34
  }

  const layout = layoutFrame({
    width,
    height,
    leftGutter,
    margins: { top: 26, bottom: bottomMargin }
  })

  let valueScale: ContinuousScale

  if (horizontal) {
    valueScale = linearScale({
      domainMin: domain.min,
      domainMax: domain.max,
      rangeMin: layout.plotX,
      rangeMax: layout.plotX + layout.plotWidth
    })
  } else {
    valueScale = linearScale({
      domainMin: domain.min,
      domainMax: domain.max,
      rangeMin: layout.plotY + layout.plotHeight,
      rangeMax: layout.plotY
    })
  }

  const zero = mapScale(valueScale, 0)
  const bars: Array<BarRect> = []

  if (horizontal) {
    const slotH = layout.plotHeight / order.length
    const barH = stacked ? Math.min(slotH * 0.6, 34) : Math.min(slotH * 0.72, laneCount * 22)

    for (let row = 0; row < order.length; row += 1) {
      const category = order[row] ?? 0
      const centerY = layout.plotY + slotH * row + slotH / 2

      if (stacked) {
        let positive = 0
        let negative = 0

        for (let lane = 0; lane < laneCount; lane += 1) {
          const series = input.series[lane]

          if (series === undefined) {
            continue
          }

          const value = series.values[category]

          if (value === undefined || value === null) {
            continue
          }

          const base = value >= 0 ? positive : negative
          const top = base + value

          if (value >= 0) {
            positive = top
          } else {
            negative = top
          }

          const xBase = mapScale(valueScale, base)
          const xTop = mapScale(valueScale, top)
          bars.push({
            category,
            lane,
            x: Math.min(xBase, xTop),
            y: centerY - barH / 2,
            w: Math.abs(xTop - xBase),
            h: barH,
            value
          })
        }
      } else {
        const laneH = Math.min(20, (barH - 4) / Math.max(1, laneCount))
        const groupTop = centerY - (laneH * laneCount + 3 * (laneCount - 1)) / 2

        for (let lane = 0; lane < laneCount; lane += 1) {
          const series = input.series[lane]

          if (series === undefined) {
            continue
          }

          const value = series.values[category]

          if (value === undefined || value === null) {
            continue
          }

          const end = mapScale(valueScale, value)
          bars.push({
            category,
            lane,
            x: Math.min(zero, end),
            y: groupTop + lane * (laneH + 3),
            w: Math.abs(end - zero),
            h: laneH,
            value
          })
        }
      }
    }
  } else {
    const slotW = layout.plotWidth / order.length
    const groupW = stacked ? Math.min(slotW * 0.62, 72) : Math.min(slotW * 0.72, laneCount * 48)

    for (let slot = 0; slot < order.length; slot += 1) {
      const category = order[slot] ?? 0
      const centerX = layout.plotX + slotW * slot + slotW / 2

      if (stacked) {
        let positive = 0
        let negative = 0

        for (let lane = 0; lane < laneCount; lane += 1) {
          const series = input.series[lane]

          if (series === undefined) {
            continue
          }

          const value = series.values[category]

          if (value === undefined || value === null) {
            continue
          }

          const base = value >= 0 ? positive : negative
          const top = base + value

          if (value >= 0) {
            positive = top
          } else {
            negative = top
          }

          const yTop = mapScale(valueScale, top)
          const yBase = mapScale(valueScale, base)
          bars.push({
            category,
            lane,
            x: centerX - groupW / 2,
            y: Math.min(yTop, yBase),
            w: groupW,
            h: Math.abs(yBase - yTop),
            value
          })
        }
      } else {
        const barW = Math.max(3, (groupW - 3 * (laneCount - 1)) / Math.max(1, laneCount))
        const groupLeft = centerX - groupW / 2

        for (let lane = 0; lane < laneCount; lane += 1) {
          const series = input.series[lane]

          if (series === undefined) {
            continue
          }

          const value = series.values[category]

          if (value === undefined || value === null) {
            continue
          }

          const end = mapScale(valueScale, value)
          bars.push({
            category,
            lane,
            x: groupLeft + lane * (barW + 3),
            y: Math.min(zero, end),
            w: barW,
            h: Math.abs(end - zero),
            value
          })
        }
      }
    }
  }

  return { layout, valueScale, zero, bars, order, domain }
}

export function renderBarChart(input: BarChartInput, options: BarChartRenderOptions): string {
  const horizontal = (input.orientation ?? 'vertical') === 'horizontal'
  const stacked = (input.mode ?? 'grouped') === 'stacked'
  const muted = (input.palette ?? 'mono') === 'muted'
  const format = readFormat(input.format)
  const width = Math.max(280, options.width)
  const geometry = layoutBars(input, width)

  if (geometry === null) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No data</p></div>`
  }

  const { layout, valueScale, zero, bars, order } = geometry

  const ticks: ReadonlyArray<ChartTick> = linearTicks({
    min: geometry.domain.min,
    max: geometry.domain.max,
    count: 4,
    format
  })

  const tickPositions: Array<number> = []

  for (const tick of ticks) {
    tickPositions.push(mapScale(valueScale, tick.value))
  }

  let svg = `<svg viewBox="0 0 ${String(layout.width)} ${String(layout.height)}" role="presentation">`
  svg += renderAxis({
    ticks,
    positions: tickPositions,
    orientation: horizontal ? 'x' : 'y',
    plotX: layout.plotX,
    plotY: layout.plotY,
    plotWidth: layout.plotWidth,
    plotHeight: layout.plotHeight
  })
  svg += `<rect x="${coord(layout.plotX)}" y="${coord(layout.plotY)}" width="${coord(layout.plotWidth)}" height="${coord(layout.plotHeight)}" class="frame"/>`

  if (horizontal) {
    svg += `<line x1="${coord(zero)}" y1="${coord(layout.plotY)}" x2="${coord(zero)}" y2="${coord(layout.plotY + layout.plotHeight)}" class="zero"/>`
  } else {
    svg += `<line x1="${coord(layout.plotX)}" y1="${coord(zero)}" x2="${coord(layout.plotX + layout.plotWidth)}" y2="${coord(zero)}" class="zero"/>`
  }

  for (let stop = 0; stop < bars.length; stop += 1) {
    const bar = bars[stop]

    if (bar === undefined) {
      continue
    }

    const lane = input.series[bar.lane]

    if (lane === undefined) {
      continue
    }

    svg += `<rect x="${coord(bar.x)}" y="${coord(bar.y)}" width="${coord(Math.max(0.5, bar.w))}" height="${coord(Math.max(0.5, bar.h))}" class="${seriesClass(bar.lane, lane.highlight ?? false, muted)}" data-stop="${String(stop)}" data-series="${String(bar.lane)}"><title>${escapeAttr(`${input.categories[bar.category] ?? ''} · ${lane.name}: ${formatNumberValue(bar.value, format)}`)}</title></rect>`
  }

  if (!horizontal) {
    const slotW = layout.plotWidth / order.length

    for (let slot = 0; slot < order.length; slot += 1) {
      const category = order[slot] ?? 0
      const label = input.categories[category] ?? ''
      const centerX = layout.plotX + slotW * slot + slotW / 2

      if (slotW < 44) {
        svg += `<text x="${coord(centerX)}" y="${coord(layout.plotY + layout.plotHeight + 18)}" text-anchor="middle" class="tick"><title>${escapeAttr(label)}</title>${escapeHtml(truncateLabel(label, 8))}</text>`
        continue
      }

      const lines = wrapLabel(label)

      for (let line = 0; line < lines.length; line += 1) {
        svg += `<text x="${coord(centerX)}" y="${coord(layout.plotY + layout.plotHeight + 16 + line * 12)}" text-anchor="middle" class="tick"><title>${escapeAttr(label)}</title>${escapeHtml(lines[line] ?? '')}</text>`
      }
    }
  } else {
    const slotH = layout.plotHeight / order.length

    for (let row = 0; row < order.length; row += 1) {
      const category = order[row] ?? 0
      const label = input.categories[category] ?? ''
      const centerY = layout.plotY + slotH * row + slotH / 2
      svg += `<text x="${coord(layout.plotX - 8)}" y="${coord(centerY + 4)}" text-anchor="end" class="tick"><title>${escapeAttr(label)}</title>${escapeHtml(truncateLabel(label, 20))}</text>`
    }
  }

  if (!stacked) {
    for (const bar of bars) {
      if (horizontal && bar.w >= 34) {
        const anchor = bar.value >= 0 ? bar.x + bar.w + 5 : bar.x - 5
        const align = bar.value >= 0 ? 'start' : 'end'
        svg += `<text x="${coord(anchor)}" y="${coord(bar.y + bar.h / 2 + 4)}" text-anchor="${align}" class="vlab">${escapeHtml(formatNumberValue(bar.value, format))}</text>`
      }

      if (!horizontal && bar.h >= 24) {
        const y = bar.value >= 0 ? bar.y - 5 : bar.y + bar.h + 14
        svg += `<text x="${coord(bar.x + bar.w / 2)}" y="${coord(y)}" text-anchor="middle" class="vlab">${escapeHtml(formatNumberValue(bar.value, format))}</text>`
      }
    }
  } else {
    for (const category of order) {
      const total = categoryTotal(input.series, category)
      let anchorX = 0
      let anchorY = 0
      let room = 0

      for (const bar of bars) {
        if (bar.category !== category) {
          continue
        }

        if (horizontal) {
          const end = bar.x + bar.w

          if (end >= anchorX) {
            anchorX = end + 5
            anchorY = bar.y + bar.h / 2 + 4
            room = end - zero
          }
        } else if (anchorY === 0 || bar.y < anchorY + 5) {
          anchorX = bar.x + bar.w / 2
          anchorY = bar.y - 5
          room = zero - bar.y
        }
      }

      if (room >= 20) {
        const align = horizontal ? 'start' : 'middle'
        svg += `<text x="${coord(anchorX)}" y="${coord(anchorY)}" text-anchor="${align}" class="vlab">${escapeHtml(formatNumberValue(total, format))}</text>`
      }
    }
  }

  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Exact values</summary><table><thead><tr><th>category</th>'

  for (const lane of input.series) {
    table += `<th class="num">${escapeHtml(lane.name)}</th>`
  }

  table += '</tr></thead><tbody>'

  for (const category of order) {
    table += `<tr><td>${escapeHtml(input.categories[category] ?? '')}</td>`

    for (const lane of input.series) {
      const value = lane.values[category]
      const cell = value === undefined || value === null ? '—' : formatNumberValue(value, format)
      table += `<td class="num">${escapeHtml(cell)}</td>`
    }

    table += '</tr>'
  }

  table += '</tbody></table></details>'

  const names = input.series.map((lane) => lane.name).join(', ')
  const aria = input.title === undefined ? `Bar chart: ${names}` : `${input.title}: ${names}`

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-bars" data-chart="bar-chart" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

/** Client stops for the shared interaction kit: one stop per bar. */
export function barChartStops(input: BarChartInput, width: number): ReadonlyArray<ChartStop> {
  const geometry = layoutBars(input, Math.max(280, width))

  if (geometry === null) {
    return []
  }

  const format = readFormat(input.format)
  const out: Array<ChartStop> = []

  for (const bar of geometry.bars) {
    const lane = input.series[bar.lane]

    if (lane === undefined) {
      continue
    }

    const label = input.categories[bar.category] ?? ''
    const html = `<b>${escapeHtml(label)}</b><div>${escapeHtml(lane.name)}: <span class="hv">${escapeHtml(formatNumberValue(bar.value, format))}</span></div>`
    out.push({ x: bar.x + bar.w / 2, y: bar.y, html })
  }

  return out
}
