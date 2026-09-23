import type { JsonValue } from '../json-value.js'
import { isJsonNumber, readArrayField, readTextField } from '../shared/guards.js'
import type { HistogramInput } from './histogram-schema.js'

/**
 * Defensive browser-side reader for validated histogram JSON. Total read,
 * null when unusable.
 */

export interface HistogramBuilder {
  title?: string
  label?: string
  bins?: number
  marker?: { value: number; label?: string }
  readonly values: Array<number>
}

export function decodeHistogramJson(record: {
  readonly [key: string]: JsonValue
}): HistogramInput | null {
  const valuesRaw = readArrayField(record, 'values')

  if (valuesRaw === null || valuesRaw.length === 0) {
    return null
  }

  const values: Array<number> = []

  for (const raw of valuesRaw) {
    if (!isJsonNumber(raw)) {
      return null
    }

    values.push(raw)
  }

  const out: HistogramBuilder = { values }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  const label = readTextField(record, 'label')

  if (label !== null) {
    out.label = label
  }

  const bins = record['bins']

  if (bins !== undefined && isJsonNumber(bins)) {
    out.bins = bins
  }

  return out
}
