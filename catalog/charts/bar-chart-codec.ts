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
import type { BarChartInput } from './bar-chart-schema.js'

/**
 * Defensive browser-side reader for validated bar-chart JSON. Total read,
 * null when unusable; the client leaves static markup alone.
 */

type Orientation = 'vertical' | 'horizontal'

type BarMode = 'grouped' | 'stacked'

type BarSorted = 'none' | 'asc' | 'desc'

type BarPalette = 'mono' | 'muted'

type BarStyle = 'decimal' | 'currency' | 'percent'

interface BuiltNumberFormat {
  style?: BarStyle
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
  const style = record['style']

  if (style === 'currency' || style === 'percent' || style === 'decimal') {
    out.style = style
  }

  const currency = readTextField(record, 'currency')

  if (currency !== null) {
    out.currency = currency
  }

  const digits = record['digits']

  if (digits !== undefined && isJsonNumber(digits)) {
    out.digits = digits
  }

  if (out.style === undefined && out.currency === undefined && out.digits === undefined) {
    return undefined
  }

  return out
}

interface BuiltSeries {
  name: string
  highlight?: boolean
  values: Array<number | null>
}

interface BuiltReference {
  value: number
  label?: string
}

function readReference(entry: JsonValue): BuiltReference | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const value = entry['value']

  if (value === undefined || !isJsonNumber(value)) {
    return null
  }

  const label = readTextField(entry, 'label')

  if (label !== null) {
    return { value, label }
  }

  return { value }
}

function readReferences(record: {
  readonly [key: string]: JsonValue
}): Array<BuiltReference> | undefined {
  const raw = readArrayField(record, 'references')

  if (raw === null) {
    return undefined
  }

  const out: Array<BuiltReference> = []

  for (const entry of raw) {
    if (out.length >= 3) {
      break
    }

    const ref = readReference(entry)

    if (ref !== null) {
      out.push(ref)
    }
  }

  if (out.length === 0) {
    return undefined
  }

  return out
}

function readValue(raw: JsonValue | undefined): number | null {
  if (raw === undefined || raw === null) {
    return null
  }

  if (!isJsonNumber(raw)) {
    return null
  }

  return raw
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

  const values: Array<number | null> = []

  for (const raw of valuesRaw) {
    values.push(readValue(raw))
  }

  const out: BuiltSeries = { name, values }

  if (readBooleanField(entry, 'highlight')) {
    out.highlight = true
  }

  return out
}

export interface BarChartBuilder {
  title?: string
  orientation?: Orientation
  mode?: BarMode
  sorted?: BarSorted
  palette?: BarPalette
  readonly categories: Array<string>
  format?: BuiltNumberFormat
  readonly series: Array<BuiltSeries>
  references?: Array<BuiltReference>
}

export function decodeBarChartJson(record: {
  readonly [key: string]: JsonValue
}): BarChartInput | null {
  const categoriesRaw = readArrayField(record, 'categories')
  const seriesRaw = readArrayField(record, 'series')

  if (categoriesRaw === null || seriesRaw === null || seriesRaw.length === 0) {
    return null
  }

  const categories: Array<string> = []

  for (const raw of categoriesRaw) {
    if (isJsonText(raw)) {
      categories.push(raw)
    }
  }

  if (categories.length === 0) {
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

  const out: BarChartBuilder = { categories, series }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  if (record['orientation'] === 'horizontal') {
    out.orientation = 'horizontal'
  }

  if (record['mode'] === 'stacked') {
    out.mode = 'stacked'
  }

  const sorted = record['sorted']

  if (sorted === 'asc' || sorted === 'desc') {
    out.sorted = sorted
  }

  if (record['palette'] === 'muted') {
    out.palette = 'muted'
  }

  const format = readNumberFormat(readRecordField(record, 'format'))

  if (format !== undefined) {
    out.format = format
  }

  const references = readReferences(record)

  if (references !== undefined) {
    out.references = references
  }

  return out
}
