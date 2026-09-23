import type { JsonValue } from '../json-value.js'
import { isJsonNumber, isJsonRecord, readArrayField, readTextField } from '../shared/guards.js'
import type { RangePlotInput } from './range-plot-schema.js'

/**
 * Defensive browser-side reader for validated range-plot JSON. Total read,
 * null when unusable.
 */

interface BuiltRow {
  label: string
  a: number
  b: number
  highlight?: boolean
}

function readRow(entry: JsonValue): BuiltRow | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const label = readTextField(entry, 'label')
  const rawA = entry['a']
  const rawB = entry['b']

  if (label === null || rawA === undefined || rawB === undefined) {
    return null
  }

  if (!isJsonNumber(rawA) || !isJsonNumber(rawB)) {
    return null
  }

  const out: BuiltRow = { label, a: rawA, b: rawB }

  if (entry['highlight'] === true) {
    out.highlight = true
  }

  return out
}

export interface RangePlotBuilder {
  title?: string
  fromLabel?: string
  toLabel?: string
  readonly rows: Array<BuiltRow>
}

export function decodeRangePlotJson(record: {
  readonly [key: string]: JsonValue
}): RangePlotInput | null {
  const rowsRaw = readArrayField(record, 'rows')

  if (rowsRaw === null || rowsRaw.length === 0) {
    return null
  }

  const rows: Array<BuiltRow> = []

  for (const entry of rowsRaw) {
    const row = readRow(entry)

    if (row !== null) {
      rows.push(row)
    }
  }

  if (rows.length === 0) {
    return null
  }

  const out: RangePlotBuilder = { rows }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  const fromLabel = readTextField(record, 'fromLabel')

  if (fromLabel !== null) {
    out.fromLabel = fromLabel
  }

  const toLabel = readTextField(record, 'toLabel')

  if (toLabel !== null) {
    out.toLabel = toLabel
  }

  return out
}
