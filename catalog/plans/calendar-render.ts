import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { CalendarEvent, CalendarInput } from './calendar-schema.js'

/**
 * Calendar renderer. A month grid, or a week strip when the requested
 * range spans ten days or less. Day arithmetic is plain civil-date math
 * (no Date, no timezone drift). Event details show on hover or focus
 * through CSS; narrow containers swap the month grid for an agenda list
 * through a container query. Pure builders, no DOM.
 */

export interface CalendarRenderOptions {
  readonly idPrefix: string
}

export interface CivilDate {
  readonly y: number
  readonly m: number
  readonly d: number
}

const MONTH_NAMES: ReadonlyArray<string> = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

export function isLeapYear(year: number): boolean {
  if (year % 4 !== 0) {
    return false
  }

  if (year % 100 !== 0) {
    return true
  }

  return year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30
  }

  return 31
}

/** Parse an ISO date without Date: returns null for wrong shapes and
 * impossible month or day values. */
export function parseIsoDate(raw: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)

  if (match === null) {
    return null
  }

  const yRaw = match[1]
  const mRaw = match[2]
  const dRaw = match[3]

  if (yRaw === undefined || mRaw === undefined || dRaw === undefined) {
    return null
  }

  const y = Number.parseInt(yRaw, 10)
  const m = Number.parseInt(mRaw, 10)
  const d = Number.parseInt(dRaw, 10)

  if (!Number.isSafeInteger(y) || !Number.isSafeInteger(m) || !Number.isSafeInteger(d)) {
    return null
  }

  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    return null
  }

  return { y, m, d }
}

/** Days since the Unix epoch for a civil date (Hinnant's algorithm). */
export function dayNumber(date: CivilDate): number {
  const yAdj = date.m <= 2 ? date.y - 1 : date.y
  const era = Math.floor((yAdj >= 0 ? yAdj : yAdj - 399) / 400)
  const yoe = yAdj - era * 400
  const mp = (date.m + 9) % 12
  const doy = Math.floor((153 * mp + 2) / 5) + date.d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy

  return era * 146097 + doe - 719468
}

/** Civil date for days since the Unix epoch. */
export function civilFromDayNumber(z: number): CivilDate {
  const shifted = z + 719468
  const era = Math.floor((shifted >= 0 ? shifted : shifted - 146096) / 146097)
  const doe = shifted - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp + 3 - 12 * Math.floor(mp / 10)

  return { y: m <= 2 ? y + 1 : y, m, d }
}

/** Weekday with Monday as 0. 1970-01-01 was a Thursday. */
export function weekdayMondayFirst(day: number): number {
  const raw = (day + 3) % 7

  return raw < 0 ? raw + 7 : raw
}

function monthName(month: number): string {
  const name = MONTH_NAMES[month - 1]

  return name === undefined ? '' : name
}

function headerNames(sundayFirst: boolean): ReadonlyArray<string> {
  if (sundayFirst) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
}

export interface EventSpan {
  readonly event: CalendarEvent
  readonly startDay: number
  readonly endDay: number
}

/** Resolve each event to a covered day range, skipping events without a
 * usable date. Callers validate first; this keeps the renderer total. */
export function resolveSpans(events: ReadonlyArray<CalendarEvent>): Array<EventSpan> {
  const out: Array<EventSpan> = []

  for (const event of events) {
    const single = event.date === undefined ? null : parseIsoDate(event.date)
    const startRaw = event.start === undefined ? null : parseIsoDate(event.start)
    const endRaw = event.end === undefined ? null : parseIsoDate(event.end)
    const base = single ?? startRaw

    if (base === null) {
      continue
    }

    const end = endRaw ?? base
    const startDay = dayNumber(base)
    const endDay = dayNumber(end)

    if (endDay < startDay) {
      continue
    }

    out.push({ event, startDay, endDay })
  }

  return out
}

function formatDay(day: number): string {
  const civil = civilFromDayNumber(day)

  return `${String(civil.d)} ${monthName(civil.m)}`
}

function formatDayWithWeekday(day: number): string {
  const names: ReadonlyArray<string> = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const civil = civilFromDayNumber(day)
  const label = names[weekdayMondayFirst(day)] ?? ''

  return `${label} ${String(civil.d)} ${monthName(civil.m)}`
}

function formatRange(startDay: number, endDay: number): string {
  if (startDay === endDay) {
    return formatDay(startDay)
  }

  const start = civilFromDayNumber(startDay)
  const end = civilFromDayNumber(endDay)

  if (start.y === end.y && start.m === end.m) {
    return `${String(start.d)}–${String(end.d)} ${monthName(end.m)}`
  }

  return `${formatDay(startDay)} – ${formatDay(endDay)}`
}

function detailText(span: EventSpan): string {
  const parts: Array<string> = [formatRange(span.startDay, span.endDay)]

  if (span.event.kind !== undefined) {
    parts.push(span.event.kind)
  }

  if (span.event.note !== undefined) {
    parts.push(span.event.note)
  }

  return parts.join(' · ')
}

function renderChip(span: EventSpan, day: number, idPrefix: string, index: number): string {
  const kind =
    span.event.kind === undefined ? '' : `<span class="ev-k">${escapeHtml(span.event.kind)}</span> `

  const cont = day === span.startDay ? '' : ' cont'

  return `<span class="ev${cont}" tabindex="0" aria-describedby="${escapeAttr(idPrefix)}-ev-${String(index)}"><span class="ev-t">${kind}${escapeHtml(span.event.title)}</span><span class="ev-d" id="${escapeAttr(idPrefix)}-ev-${String(index)}">${escapeHtml(detailText(span))}</span></span>`
}

function spansOnDay(spans: ReadonlyArray<EventSpan>, day: number): Array<EventSpan> {
  const out: Array<EventSpan> = []

  for (const span of spans) {
    if (day >= span.startDay && day <= span.endDay) {
      out.push(span)
    }
  }

  return out
}

interface MonthGrid {
  readonly year: number
  readonly month: number
  readonly weeks: Array<Array<number>>
}

function monthGrid(year: number, month: number, sundayFirst: boolean): MonthGrid {
  const first = dayNumber({ y: year, m: month, d: 1 })
  const mondayFirst = weekdayMondayFirst(first)
  const offset = sundayFirst ? (mondayFirst + 1) % 7 : mondayFirst
  const total = offset + daysInMonth(year, month)
  const weekCount = Math.ceil(total / 7)
  const weeks: Array<Array<number>> = []

  for (let week = 0; week < weekCount; week += 1) {
    const days: Array<number> = []

    for (let slot = 0; slot < 7; slot += 1) {
      days.push(first - offset + week * 7 + slot)
    }

    weeks.push(days)
  }

  return { year, month, weeks }
}

function renderMonthGrid(
  input: CalendarInput,
  spans: ReadonlyArray<EventSpan>,
  grid: MonthGrid,
  todayDay: number | null,
  idPrefix: string
): string {
  const sundayFirst = (input.weekStart ?? 'monday') === 'sunday'
  let head = '<thead><tr>'

  for (const name of headerNames(sundayFirst)) {
    head += `<th scope="col">${name}</th>`
  }

  head += '</tr></thead>'

  let body = '<tbody>'

  for (const week of grid.weeks) {
    body += '<tr>'

    for (const day of week) {
      const civil = civilFromDayNumber(day)
      const outside = civil.m === grid.month ? '' : ' out'
      const today = day === todayDay ? ' today' : ''
      const todayMark = day === todayDay ? ' <span class="td">today</span>' : ''
      let chips = ''

      for (const span of spansOnDay(spans, day)) {
        const at = spans.indexOf(span)
        chips += renderChip(span, day, idPrefix, at < 0 ? 0 : at)
      }

      body += `<td class="day${outside}${today}"><span class="dnum">${String(civil.d)}${todayMark}</span>${chips}</td>`
    }

    body += '</tr>'
  }

  body += '</tbody>'

  return `<table class="cal-grid" aria-label="${escapeAttr(monthName(grid.month))} ${String(grid.year)}">${head}${body}</table>`
}

function renderAgenda(spans: ReadonlyArray<EventSpan>): string {
  const ordered = [...spans].sort((left, right) => left.startDay - right.startDay)

  let items = ''

  for (const span of ordered) {
    const note =
      span.event.note === undefined
        ? ''
        : `<span class="ad-n">${escapeHtml(span.event.note)}</span>`

    const kind =
      span.event.kind === undefined
        ? ''
        : `<span class="ad-k">${escapeHtml(span.event.kind)}</span> `

    items += `<li><span class="ad-date">${escapeHtml(formatDayWithWeekday(span.startDay))}</span><span class="ad-body">${kind}<span class="ad-t">${escapeHtml(span.event.title)}</span> <span class="ad-r">${escapeHtml(formatRange(span.startDay, span.endDay))}</span>${note}</span></li>`
  }

  return `<ol class="cal-agenda">${items}</ol>`
}

function renderStrip(
  spans: ReadonlyArray<EventSpan>,
  firstDay: number,
  lastDay: number,
  todayDay: number | null,
  idPrefix: string
): string {
  let cells = ''

  for (let day = firstDay; day <= lastDay; day += 1) {
    const civil = civilFromDayNumber(day)
    const names: ReadonlyArray<string> = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const label = names[weekdayMondayFirst(day)] ?? ''
    const today = day === todayDay ? ' today' : ''
    const todayMark = day === todayDay ? ' <span class="td">today</span>' : ''
    let chips = ''

    for (const span of spansOnDay(spans, day)) {
      const at = spans.indexOf(span)
      chips += renderChip(span, day, idPrefix, at < 0 ? 0 : at)
    }

    cells += `<div class="strip-day${today}"><p class="sd-h">${label} ${String(civil.d)}${todayMark}</p>${chips}</div>`
  }

  const columns = lastDay - firstDay + 1

  return `<div class="tw"><div class="cal-strip" style="grid-template-columns: repeat(${String(columns)}, minmax(0, 1fr));">${cells}</div></div>`
}

export function renderCalendar(input: CalendarInput, options: CalendarRenderOptions): string {
  const spans = resolveSpans(input.events)

  const todayDay =
    input.today === undefined
      ? null
      : (() => {
          const parsed = parseIsoDate(input.today)

          return parsed === null ? null : dayNumber(parsed)
        })()

  const rangeStart = input.start === undefined ? null : parseIsoDate(input.start)
  const rangeEnd = input.end === undefined ? null : parseIsoDate(input.end)
  let inner = ''

  if (rangeStart !== null && rangeEnd !== null) {
    const firstDay = dayNumber(rangeStart)
    const lastDay = dayNumber(rangeEnd)

    if (lastDay - firstDay <= 9) {
      inner = renderStrip(spans, firstDay, lastDay, todayDay, options.idPrefix)
    } else {
      inner = renderMonthGrid(
        input,
        spans,
        monthGrid(rangeStart.y, rangeStart.m, (input.weekStart ?? 'monday') === 'sunday'),
        todayDay,
        options.idPrefix
      )
      inner += renderAgenda(spans)
    }
  } else {
    const monthRaw =
      input.month ??
      `${String(rangeStart?.y ?? 0).padStart(4, '0')}-${String(rangeStart?.m ?? 0).padStart(2, '0')}`

    const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthRaw)

    if (monthMatch !== null) {
      const yRaw = monthMatch[1]
      const mRaw = monthMatch[2]

      if (yRaw !== undefined && mRaw !== undefined) {
        inner = renderMonthGrid(
          input,
          spans,
          monthGrid(
            Number.parseInt(yRaw, 10),
            Number.parseInt(mRaw, 10),
            (input.weekStart ?? 'monday') === 'sunday'
          ),
          todayDay,
          options.idPrefix
        )

        inner += renderAgenda(spans)
      }
    }
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-cal" data-cal="calendar" data-cal-id="${escapeAttr(options.idPrefix)}">${title}${inner}</div>`
}
