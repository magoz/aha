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
import type { LineChartInput } from './line-chart-schema.js'

/**
 * Defensive browser-side reader for validated line-chart JSON. The build
 * already decoded this block with Effect Schema; the client only needs a
 * total read so hand-edited markup cannot throw. Returns null when the
 * block is unusable, in which case the client leaves static markup alone.
 */

type XKind = 'number' | 'time' | 'category'

type AxisScale = 'linear' | 'log'

type Palette = 'mono' | 'muted'

type NumberStyle = 'decimal' | 'currency' | 'percent'

function readKind(raw: JsonValue | undefined): XKind {
  if (raw === 'time') {
    return 'time'
  }

  if (raw === 'category') {
    return 'category'
  }

  return 'number'
}

function readScale(raw: JsonValue | undefined): AxisScale | undefined {
  if (raw === 'log') {
    return 'log'
  }

  return undefined
}

function readPalette(raw: JsonValue | undefined): Palette | undefined {
  if (raw === 'muted') {
    return 'muted'
  }

  return undefined
}

function readStyle(raw: JsonValue | undefined): NumberStyle | undefined {
  if (raw === 'currency' || raw === 'percent' || raw === 'decimal') {
    return raw
  }

  return undefined
}

interface BuiltNumberFormat {
  style?: NumberStyle
  currency?: string
  digits?: number
}

function readNumberFormat(
  record: { readonly [key: string]: JsonValue } | null
): BuiltNumberFormat | undefined {
  if (record === null) {
    return undefined
  }

  const out: BuiltNumberFormat = {}
  const style = readStyle(record['style'])

  if (style !== undefined) {
    out.style = style
  }

  const currency = readTextField(record, 'currency')

  if (currency !== null) {
    out.currency = currency
  }

  const digitsRaw = record['digits']

  if (digitsRaw !== undefined && isJsonNumber(digitsRaw)) {
    out.digits = digitsRaw
  }

  if (out.style === undefined && out.currency === undefined && out.digits === undefined) {
    return undefined
  }

  return out
}

interface BuiltPoint {
  x: number | string
  y: number | null
}

interface BuiltSeries {
  name: string
  highlight?: boolean
  values: Array<BuiltPoint>
}

export interface LineChartXBuilder {
  readonly kind: XKind
  label?: string
  scale?: AxisScale
  format?: BuiltNumberFormat
}

export interface LineChartYBuilder {
  label?: string
  scale?: AxisScale
  format?: BuiltNumberFormat
}

export interface LineChartBuilder {
  title?: string
  palette?: Palette
  readonly x: LineChartXBuilder
  y?: LineChartYBuilder
  readonly series: Array<BuiltSeries>
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

  if (name === null) {
    return null
  }

  const valuesRaw = readArrayField(entry, 'values')

  if (valuesRaw === null) {
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

export function decodeLineChartJson(record: {
  readonly [key: string]: JsonValue
}): LineChartInput | null {
  const xRecord = readRecordField(record, 'x')
  const seriesRaw = readArrayField(record, 'series')

  if (xRecord === null || seriesRaw === null || seriesRaw.length === 0) {
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

  const xBase: LineChartXBuilder = { kind: readKind(xRecord['kind']) }
  const xLabel = readTextField(xRecord, 'label')

  if (xLabel !== null) {
    xBase.label = xLabel
  }

  const xScale = readScale(xRecord['scale'])

  if (xScale !== undefined) {
    xBase.scale = xScale
  }

  const xFormat = readNumberFormat(readRecordField(xRecord, 'format'))

  if (xFormat !== undefined) {
    xBase.format = xFormat
  }

  const out: LineChartBuilder = { x: xBase, series }

  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  const palette = readPalette(record['palette'])

  if (palette !== undefined) {
    out.palette = palette
  }

  const yRecord = readRecordField(record, 'y')

  if (yRecord !== null) {
    const yBase: LineChartYBuilder = {}
    const yLabel = readTextField(yRecord, 'label')

    if (yLabel !== null) {
      yBase.label = yLabel
    }

    const yScale = readScale(yRecord['scale'])

    if (yScale !== undefined) {
      yBase.scale = yScale
    }

    const yFormat = readNumberFormat(readRecordField(yRecord, 'format'))

    if (yFormat !== undefined) {
      yBase.format = yFormat
    }

    out.y = yBase
  }

  return out
}
