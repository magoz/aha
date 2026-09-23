import { Predicate } from 'effect'

import type { JsonValue } from '../json-value.js'

/**
 * Linear, log and time scales as plain data plus pure mapping functions.
 * Renderers use these in Node and the same code is bundled for browsers.
 */

export interface LinearScale {
  readonly kind: 'linear'
  readonly domainMin: number
  readonly domainMax: number
  readonly rangeMin: number
  readonly rangeMax: number
}

export interface LogScale {
  readonly kind: 'log'
  readonly domainMin: number
  readonly domainMax: number
  readonly rangeMin: number
  readonly rangeMax: number
}

export interface TimeScale {
  readonly kind: 'time'
  readonly domainMin: number
  readonly domainMax: number
  readonly rangeMin: number
  readonly rangeMax: number
}

export type ContinuousScale = LinearScale | LogScale | TimeScale

export interface ScaleInput {
  readonly domainMin: number
  readonly domainMax: number
  readonly rangeMin: number
  readonly rangeMax: number
}

function spanOf(input: ScaleInput): number {
  const span = input.domainMax - input.domainMin

  if (span === 0) {
    return 1
  }

  return span
}

export function linearScale(input: ScaleInput): LinearScale {
  return {
    kind: 'linear',
    domainMin: input.domainMin,
    domainMax: input.domainMax,
    rangeMin: input.rangeMin,
    rangeMax: input.rangeMax
  }
}

export function logScale(input: ScaleInput): LogScale {
  const safeMin = input.domainMin > 0 ? input.domainMin : 1
  const safeMax = input.domainMax > safeMin ? input.domainMax : safeMin * 10

  return {
    kind: 'log',
    domainMin: safeMin,
    domainMax: safeMax,
    rangeMin: input.rangeMin,
    rangeMax: input.rangeMax
  }
}

export function timeScale(input: ScaleInput): TimeScale {
  return {
    kind: 'time',
    domainMin: input.domainMin,
    domainMax: input.domainMax,
    rangeMin: input.rangeMin,
    rangeMax: input.rangeMax
  }
}

export function mapLinear(scale: LinearScale, value: number): number {
  const ratio = (value - scale.domainMin) / spanOf(scale)

  return scale.rangeMin + ratio * (scale.rangeMax - scale.rangeMin)
}

export function mapLog(scale: LogScale, value: number): number {
  const safe = value > 0 ? value : scale.domainMin

  const ratio =
    (Math.log10(safe) - Math.log10(scale.domainMin)) /
    (Math.log10(scale.domainMax) - Math.log10(scale.domainMin))

  return scale.rangeMin + ratio * (scale.rangeMax - scale.rangeMin)
}

export function mapTime(scale: TimeScale, value: number): number {
  const ratio = (value - scale.domainMin) / spanOf(scale)

  return scale.rangeMin + ratio * (scale.rangeMax - scale.rangeMin)
}

export function mapScale(scale: ContinuousScale, value: number): number {
  if (scale.kind === 'log') {
    return mapLog(scale, value)
  }

  if (scale.kind === 'time') {
    return mapTime(scale, value)
  }

  return mapLinear(scale, value)
}

function isJsonObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return Predicate.isObject(value)
}

export function readNumberField(
  record: { readonly [key: string]: JsonValue },
  key: string
): number | null {
  const raw = record[key]

  if (raw === undefined || !Predicate.isNumber(raw)) {
    return null
  }

  return raw
}

export function readStringField(
  record: { readonly [key: string]: JsonValue },
  key: string
): string | null {
  const raw = record[key]

  if (raw === undefined || !Predicate.isString(raw)) {
    return null
  }

  return raw
}

export function asJsonObject(value: JsonValue): { readonly [key: string]: JsonValue } | null {
  if (isJsonObject(value)) {
    return value
  }

  return null
}
