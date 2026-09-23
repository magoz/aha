import { parseDiagramDate, wrapLabel } from './layout.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import { formatDateTick, formatFullDate } from '../shared/format.js'
import { mapScale, timeScale } from '../shared/scales.js'
import { timeTicks } from '../shared/ticks.js'
import type { TimelineInput } from './timeline-schema.js'

/**
 * Timeline renderer. Phases as span bars on a shared date axis,
 * milestones as diamonds on a lane below, and an optional dashed today
 * marker. Phase labels sit inside wide bars and beside narrow ones, so
 * nothing overflows at 390px. A resize-only client keeps the static
 * render (default 640px) matched to the live container width.
 */

export const TIMELINE_WIDTH = 640

const PLOT_X = 8

const AXIS_Y = 34

const ROW_TOP = 46

const ROW_H = 46

const BAR_H = 22

export interface TimelineRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

function truncLabel(label: string, maxChars: number): string {
  const safeMax = Math.max(4, Math.floor(maxChars))

  if (label.length <= safeMax) {
    return label
  }

  return `${label.slice(0, safeMax - 1)}…`
}

export function renderTimeline(input: TimelineInput, options: TimelineRenderOptions): string {
  const span = Math.max(300, options.width)
  const plotW = span - PLOT_X * 2

  const starts: Array<number> = []
  const ends: Array<number> = []
  const milestoneDates: Array<number> = []
  let today: number | null = null

  for (const phase of input.phases) {
    const start = parseDiagramDate(phase.start)
    const end = parseDiagramDate(phase.end)

    if (start !== null && end !== null) {
      starts.push(start)
      ends.push(end)
    }
  }

  for (const milestone of input.milestones ?? []) {
    const date = parseDiagramDate(milestone.date)

    if (date !== null) {
      milestoneDates.push(date)
    }
  }

  if (input.today !== undefined) {
    today = parseDiagramDate(input.today)
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const value of starts) {
    if (value < min) {
      min = value
    }
  }

  for (const value of ends) {
    if (value > max) {
      max = value
    }
  }

  for (const value of milestoneDates) {
    if (value < min) {
      min = value
    }

    if (value > max) {
      max = value
    }
  }

  if (today !== null) {
    if (today < min) {
      min = today
    }

    if (today > max) {
      max = today
    }
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    min = 0
    max = 86_400_000
  }

  if (max <= min) {
    max = min + 86_400_000
  }

  const pad = (max - min) * 0.04
  const domainMin = min - pad
  const domainMax = max + pad

  const scale = timeScale({
    domainMin,
    domainMax,
    rangeMin: PLOT_X,
    rangeMax: PLOT_X + plotW
  })

  const ticks = timeTicks({ min: domainMin, max: domainMax, count: 5 })
  const laneY = ROW_TOP + input.phases.length * ROW_H + 8
  const height = laneY + 56 + 10

  let svg = `<svg viewBox="0 0 ${coord(span)} ${coord(height)}" role="presentation" data-span="${coord(span)}">`

  for (const tick of ticks) {
    const x = mapScale(scale, tick.value)
    svg += `<line x1="${coord(x)}" y1="${coord(AXIS_Y)}" x2="${coord(x)}" y2="${coord(laneY + 44)}" class="grid"/>`
    svg += `<text x="${coord(x)}" y="26" text-anchor="middle" class="tick">${escapeHtml(formatDateTick(tick.value))}</text>`
  }

  svg += `<line x1="${coord(PLOT_X)}" y1="${coord(AXIS_Y)}" x2="${coord(PLOT_X + plotW)}" y2="${coord(AXIS_Y)}" class="axis"/>`

  for (let index = 0; index < input.phases.length; index += 1) {
    const phase = input.phases[index]

    if (phase === undefined) {
      continue
    }

    const start = parseDiagramDate(phase.start) ?? domainMin
    const end = parseDiagramDate(phase.end) ?? domainMax
    const x1 = mapScale(scale, Math.min(start, end))
    const x2 = Math.max(mapScale(scale, Math.max(start, end)), x1 + 3)
    const barY = ROW_TOP + index * ROW_H + 12
    const hi = phase.highlight ?? false
    const cls = hi ? 'bar hi' : 'bar'
    const label = phase.label
    const textW = label.length * 6.6
    const barW = x2 - x1
    svg += `<rect x="${coord(x1)}" y="${coord(barY)}" width="${coord(barW)}" height="${BAR_H}" class="${cls}"><title>${escapeAttr(`${label}: ${formatFullDate(start)} – ${formatFullDate(end)}`)}</title></rect>`

    if (barW >= textW + 20) {
      const lblCls = hi ? 'blbl in hi' : 'blbl in'
      svg += `<text x="${coord((x1 + x2) / 2)}" y="${coord(barY + 15)}" text-anchor="middle" class="${lblCls}">${escapeHtml(label)}</text>`
      continue
    }

    const availRight = PLOT_X + plotW - x2 - 6
    const availLeft = x1 - PLOT_X - 6

    if (availRight >= textW + 4) {
      const lblCls = hi ? 'blbl hi' : 'blbl'
      svg += `<text x="${coord(x2 + 6)}" y="${coord(barY + 15)}" text-anchor="start" class="${lblCls}">${escapeHtml(label)}</text>`
      continue
    }

    if (availLeft >= textW + 4) {
      const lblCls = hi ? 'blbl hi' : 'blbl'
      svg += `<text x="${coord(x1 - 6)}" y="${coord(barY + 15)}" text-anchor="end" class="${lblCls}">${escapeHtml(label)}</text>`
      continue
    }

    const lblCls = hi ? 'blbl hi' : 'blbl'

    if (availRight >= 30) {
      const maxChars = Math.floor(availRight / 6.6)
      svg += `<text x="${coord(x2 + 6)}" y="${coord(barY + 15)}" text-anchor="start" class="${lblCls}">${escapeHtml(truncLabel(label, maxChars))}</text>`
      continue
    }

    const maxChars = Math.max(4, Math.floor((x2 - PLOT_X) / 6.6))
    svg += `<text x="${coord(x2)}" y="${coord(barY - 4)}" text-anchor="end" class="${lblCls}">${escapeHtml(truncLabel(label, maxChars))}</text>`
  }

  for (let index = 0; index < (input.milestones ?? []).length; index += 1) {
    const milestone = (input.milestones ?? [])[index]

    if (milestone === undefined) {
      continue
    }

    const date = parseDiagramDate(milestone.date) ?? domainMin
    const x = mapScale(scale, date)
    const upper = index % 2 === 0
    svg += `<polygon points="${coord(x)},${coord(laneY - 7)} ${coord(x + 7)},${coord(laneY)} ${coord(x)},${coord(laneY + 7)} ${coord(x - 7)},${coord(laneY)}" class="ms"><title>${escapeAttr(`${milestone.label}: ${formatFullDate(date)}`)}</title></polygon>`

    const lines = wrapLabel(milestone.label, 16)

    for (let line = 0; line < lines.length; line += 1) {
      const text = lines[line] ?? ''
      const y = upper ? laneY + 22 + line * 13 : laneY + 36 + line * 13
      svg += `<text x="${coord(x)}" y="${coord(y)}" text-anchor="middle" class="mlbl">${escapeHtml(text)}</text>`
    }
  }

  if (today !== null) {
    const x = mapScale(scale, today)
    const nearRight = x > PLOT_X + plotW - 44
    svg += `<line x1="${coord(x)}" y1="${coord(AXIS_Y)}" x2="${coord(x)}" y2="${coord(laneY + 44)}" class="today"/>`

    if (nearRight) {
      svg += `<text x="${coord(x - 5)}" y="14" text-anchor="end" class="todaylbl">today</text>`
    } else {
      svg += `<text x="${coord(x + 5)}" y="14" text-anchor="start" class="todaylbl">today</text>`
    }
  }

  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Dates</summary><table><thead><tr><th>item</th><th>start</th><th>end</th></tr></thead><tbody>'

  for (const phase of input.phases) {
    const start = parseDiagramDate(phase.start)
    const end = parseDiagramDate(phase.end)
    const startText = start === null ? '—' : formatFullDate(start)
    const endText = end === null ? '—' : formatFullDate(end)
    table += `<tr><td>${escapeHtml(phase.label)}</td><td>${escapeHtml(startText)}</td><td>${escapeHtml(endText)}</td></tr>`
  }

  for (const milestone of input.milestones ?? []) {
    const date = parseDiagramDate(milestone.date)
    const dateText = date === null ? '—' : formatFullDate(date)
    table += `<tr><td>◆ ${escapeHtml(milestone.label)}</td><td>${escapeHtml(dateText)}</td><td>—</td></tr>`
  }

  table += '</tbody></table></details>'

  const names: Array<string> = []

  for (const phase of input.phases) {
    names.push(phase.label)
  }

  const aria =
    input.title === undefined
      ? `Timeline: ${names.join(', ')}`
      : `${input.title}: ${names.join(', ')}`

  const title = input.title === undefined ? '' : `<p class="dtitle">${escapeHtml(input.title)}</p>`

  return `<div class="aha-diagram aha-timeline" data-diagram="timeline" data-diagram-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${table}</div>`
}
