import type { JsonValue } from '../json-value.js'
import {
  isJsonNumber,
  isJsonRecord,
  isJsonText,
  readArrayField,
  readBooleanField,
  readRecordField,
  readTextField
} from '../shared/guards.js'
import type { AreaChartInput } from './area-chart-schema.js'

/**
 * Defensive browser-side reader for validated area-chart JSON. Total read,
 * null when unusable.
 */

interface BuiltPoint {
  x: number | string
  y: number | null
}

interface BuiltSeries {
  name: string
  highlight?: boolean
  values: Array<BuiltPoint>
}

function readPoint(point: JsonValue): BuiltPoint | null {
  if (!isJsonRecord(point)) {
    return null
  }

  const rawX = point['x']

  if (rawX === undefined || (!isJsonNumber(rawX) && !isJsonText(rawX))) {
    return null
  }

  const rawY = point['y']

  if (rawY === undefined || rawY === null) {
    return { x: rawX, y: null }
  }

  if (!isJsonNumber(rawY)) {
    return null
  }

  return { x: rawX, y: rawY }
}

function readSeries(entry: JsonValue): BuiltSeries | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const name = readTextField(entry, 'name')
  const valuesRaw = readArrayField(entry, 'values')

  if (name === null || valuesRaw === null) {
    return null
  }

  const values: Array<BuiltPoint> = []

  for (const raw of valuesRaw) {
    const point = readPoint(raw)

    if (point !== null) {
      values.push(point)
    }
  }

  const out: BuiltSeries = { name, values }

  if (readBooleanField(entry, 'highlight')) {
    out.highlight = true
  }

  return out
}

export interface AreaXBuilder {
  readonly kind: 'number' | 'time'
  label?: string
}

export interface AreaYBuilder {
  label?: string
}

export interface AreaChartBuilder {
  title?: string
  mode?: 'stacked' | 'overlap'
  percent?: boolean
  palette?: 'mono' | 'muted'
  readonly x: { readonly kind: 'number' | 'time'; label?: string }
  y?: { label?: string }
  readonly series: Array<BuiltSeries>
}

export function decodeAreaChartJson(record: {
  readonly [key: string]: JsonValue
}): AreaChartInput | null {
  const xRecord = readRecordField(record, 'x')
  const seriesRaw = readArrayField(record, 'series')

  if (xRecord === null || seriesRaw === null || seriesRaw.length === 0) {
    return null
  }

  const kind = xRecord['kind']

  if (kind !== 'number' && kind !== 'time') {
    return null
  }

  const series: Array<BuiltSeries> = []

  for (const entry of seriesRaw) {
    const lane = readSeries(entry)

    if (lane !== null) {
      series.push(lane)
    }
  }

  if (series.length === 0) {
    return null
  }

  const xBase: AreaXBuilder = { kind }
  const xLabel = readTextField(xRecord, 'label')

  if (xLabel !== null) {
    xBase.label = xLabel
  }

  const out: AreaChartBuilder = { x: xBase, series }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  if (record['mode'] === 'overlap') {
    out.mode = 'overlap'
  }

  if (readBooleanField(record, 'percent')) {
    out.percent = true
  }

  if (record['palette'] === 'muted') {
    out.palette = 'muted'
  }

  const yRecord = readRecordField(record, 'y')

  if (yRecord !== null) {
    const yBase: AreaYBuilder = {}
    const yLabel = readTextField(yRecord, 'label')

    if (yLabel !== null) {
      yBase.label = yLabel
    }

    out.y = yBase
  }

  return out
}
