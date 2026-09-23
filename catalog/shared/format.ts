/**
 * Number, currency, percent and date formatting for chart ticks and tooltips.
 * Pure functions shared by Node renderers and browser bundles.
 */

import { Predicate } from 'effect'

export type NumberStyle = 'decimal' | 'currency' | 'percent'

export interface NumberFormatSpec {
  readonly style: NumberStyle
  readonly currency: string | null
  readonly digits: number | null
}

export function defaultNumberFormat(): NumberFormatSpec {
  return { style: 'decimal', currency: null, digits: null }
}

function withDigits(
  digits: number | null,
  body: Intl.NumberFormatOptions
): Intl.NumberFormatOptions {
  if (digits === null) {
    return body
  }

  return { ...body, minimumFractionDigits: digits, maximumFractionDigits: digits }
}

export function formatNumberValue(value: number, spec: NumberFormatSpec): string {
  if (spec.style === 'percent') {
    return new Intl.NumberFormat('en-US', withDigits(spec.digits, { style: 'percent' })).format(
      value
    )
  }

  if (spec.style === 'currency') {
    const code = spec.currency ?? 'USD'

    return new Intl.NumberFormat(
      'en-US',
      withDigits(spec.digits, { style: 'currency', currency: code })
    ).format(value)
  }

  return new Intl.NumberFormat('en-US', withDigits(spec.digits, {})).format(value)
}

const MONTH_NAMES: ReadonlyArray<string> = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

function twoDigits(value: number): string {
  if (value < 10) {
    return `0${String(value)}`
  }

  return String(value)
}

export function formatDateTick(millis: number): string {
  const date = new Date(millis)
  const month = MONTH_NAMES[date.getUTCMonth()]

  return `${month === undefined ? '' : month} ${String(date.getUTCDate())}`
}

export function formatDateTimeTick(millis: number): string {
  const date = new Date(millis)

  return `${formatDateTick(millis)} ${twoDigits(date.getUTCHours())}:00`
}

export function formatHourTick(millis: number): string {
  const date = new Date(millis)

  return `${twoDigits(date.getUTCHours())}:00`
}

export function formatFullDate(millis: number): string {
  const date = new Date(millis)
  const month = MONTH_NAMES[date.getUTCMonth()]

  return `${month === undefined ? '' : month} ${String(date.getUTCDate())}, ${String(date.getUTCFullYear())}`
}

export function parseTimeInput(value: string | number): number | null {
  if (Predicate.isNumber(value)) {
    return value
  }

  const millis = Date.parse(value)

  if (Number.isNaN(millis)) {
    return null
  }

  return millis
}
