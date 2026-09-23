import type { JsonValue } from '../json-value.js'
import { isJsonNumber, isJsonText, readArrayField, readTextField } from '../shared/guards.js'
import type { HeatmapInput } from './heatmap-schema.js'

/**
 * Defensive browser-side reader for validated heatmap JSON. Total read,
 * null when unusable.
 */

export interface HeatmapBuilder {
  title?: string
  readonly rows: Array<string>
  readonly columns: Array<string>
  readonly values: Array<Array<number | null>>
}

export function decodeHeatmapJson(record: {
  readonly [key: string]: JsonValue
}): HeatmapInput | null {
  const rowsRaw = readArrayField(record, 'rows')
  const columnsRaw = readArrayField(record, 'columns')
  const valuesRaw = readArrayField(record, 'values')

  if (rowsRaw === null || columnsRaw === null || valuesRaw === null) {
    return null
  }

  const rows: Array<string> = []

  for (const raw of rowsRaw) {
    if (isJsonText(raw)) {
      rows.push(raw)
    }
  }

  const columns: Array<string> = []

  for (const raw of columnsRaw) {
    if (isJsonText(raw)) {
      columns.push(raw)
    }
  }

  if (rows.length === 0 || columns.length === 0) {
    return null
  }

  const values: Array<Array<number | null>> = []

  for (const line of valuesRaw) {
    if (!Array.isArray(line)) {
      return null
    }

    const out: Array<number | null> = []

    for (const cell of line) {
      const value: JsonValue = cell

      if (value === null) {
        out.push(null)
        continue
      }

      if (!isJsonNumber(value)) {
        return null
      }

      out.push(value)
    }

    values.push(out)
  }

  if (values.length === 0) {
    return null
  }

  const out: HeatmapBuilder = { rows, columns, values }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  return out
}
