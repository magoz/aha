import { formatDateTick, formatDateTimeTick, formatNumberValue } from './format.js'
import type { NumberFormatSpec } from './format.js'

/**
 * Nice ticks for linear, log and time scales. Pure functions shared by
 * Node renderers and browser bundles.
 */

export interface ChartTick {
  readonly value: number
  readonly label: string
}

function tickStep(span: number, count: number): number {
  const raw = span / count
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

export interface LinearTickInput {
  readonly min: number
  readonly max: number
  readonly count: number
  readonly format: NumberFormatSpec
}

export function linearTicks(input: LinearTickInput): ReadonlyArray<ChartTick> {
  if (input.max <= input.min) {
    return [{ value: input.min, label: formatNumberValue(input.min, input.format) }]
  }

  const step = tickStep(input.max - input.min, input.count)
  const start = Math.ceil(input.min / step) * step
  const out: Array<ChartTick> = []
  let cursor = start
  let guard = 0

  while (cursor <= input.max + step / 2 && guard < 12) {
    const rounded = Math.round(cursor * 1e9) / 1e9
    out.push({ value: rounded, label: formatNumberValue(rounded, input.format) })
    cursor += step
    guard += 1
  }

  return out
}

export interface LogTickInput {
  readonly min: number
  readonly max: number
  readonly format: NumberFormatSpec
}

export function logTicks(input: LogTickInput): ReadonlyArray<ChartTick> {
  const safeMin = input.min > 0 ? input.min : 1
  const safeMax = input.max > safeMin ? input.max : safeMin * 10
  const low = Math.ceil(Math.log10(safeMin))
  const high = Math.floor(Math.log10(safeMax))
  const out: Array<ChartTick> = []

  for (let power = low; power <= high; power += 1) {
    const value = 10 ** power
    out.push({ value, label: formatNumberValue(value, input.format) })
  }

  if (out.length === 0) {
    out.push({ value: safeMin, label: formatNumberValue(safeMin, input.format) })
  }

  return out
}

const HOUR_MILLIS = 3_600_000

const DAY_MILLIS = 86_400_000

export interface TimeTickInput {
  readonly min: number
  readonly max: number
  readonly count: number
}

export function timeTicks(input: TimeTickInput): ReadonlyArray<ChartTick> {
  if (input.max <= input.min) {
    return [{ value: input.min, label: formatDateTick(input.min) }]
  }

  const span = input.max - input.min
  const target = span / input.count

  const steps: ReadonlyArray<number> = [
    HOUR_MILLIS,
    3 * HOUR_MILLIS,
    6 * HOUR_MILLIS,
    12 * HOUR_MILLIS,
    DAY_MILLIS,
    2 * DAY_MILLIS,
    7 * DAY_MILLIS,
    30 * DAY_MILLIS
  ]

  let step = steps[steps.length - 1] ?? 30 * DAY_MILLIS

  for (const candidate of steps) {
    if (candidate >= target) {
      step = candidate
      break
    }
  }

  const useTime = step < DAY_MILLIS
  const start = Math.ceil(input.min / step) * step
  const out: Array<ChartTick> = []
  let cursor = start
  let guard = 0

  while (cursor <= input.max && guard < 10) {
    out.push({
      value: cursor,
      label: useTime ? formatDateTimeTick(cursor) : formatDateTick(cursor)
    })
    cursor += step
    guard += 1
  }

  if (out.length === 0) {
    out.push({ value: input.min, label: formatDateTick(input.min) })
  }

  return out
}

export interface TwoTickInput {
  readonly min: number
  readonly max: number
  readonly format: NumberFormatSpec
}

/**
 * Guarantee at least two labelled ticks for small multiples: keep the
 * computed ticks when there are two or more, otherwise fall back to the
 * domain ends so every row stays readable.
 */
export function ensureTwoTicks(
  ticks: ReadonlyArray<ChartTick>,
  input: TwoTickInput
): ReadonlyArray<ChartTick> {
  if (ticks.length >= 2) {
    return ticks
  }

  if (ticks.length === 1) {
    const only = ticks[0]

    if (only !== undefined && Math.abs(only.value - input.min) < Math.abs(only.value - input.max)) {
      return [only, { value: input.max, label: formatNumberValue(input.max, input.format) }]
    }

    if (only !== undefined) {
      return [{ value: input.min, label: formatNumberValue(input.min, input.format) }, only]
    }
  }

  return [
    { value: input.min, label: formatNumberValue(input.min, input.format) },
    { value: input.max, label: formatNumberValue(input.max, input.format) }
  ]
}
