import type { JsonValue } from '../json-value.js'
import { isJsonNumber, readArrayField, readTextField } from '../shared/guards.js'
import type { SparklineInput } from './sparkline-schema.js'

/**
 * Defensive browser-side reader for validated sparkline JSON. Total read,
 * null when unusable.
 */

export interface SparklineBuilder {
  label?: string
  readonly values: Array<number | null>
  showLast?: boolean
  markExtremes?: boolean
}

export function decodeSparklineJson(record: {
  readonly [key: string]: JsonValue
}): SparklineInput | null {
  const valuesRaw = readArrayField(record, 'values')

  if (valuesRaw === null || valuesRaw.length === 0) {
    return null
  }

  const values: Array<number | null> = []

  for (const raw of valuesRaw) {
    if (raw === null) {
      values.push(null)
      continue
    }

    if (!isJsonNumber(raw)) {
      return null
    }

    values.push(raw)
  }

  const out: SparklineBuilder = { values }
  const label = readTextField(record, 'label')

  if (label !== null) {
    out.label = label
  }

  if (record['showLast'] === false) {
    out.showLast = false
  }

  if (record['markExtremes'] === false) {
    out.markExtremes = false
  }

  return out
}
