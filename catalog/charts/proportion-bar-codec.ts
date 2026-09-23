import type { JsonValue } from '../json-value.js'
import { isJsonNumber, isJsonRecord, readArrayField, readTextField } from '../shared/guards.js'
import type { ProportionBarInput } from './proportion-bar-schema.js'

/**
 * Defensive browser-side reader for validated proportion-bar JSON. Total
 * read, null when unusable.
 */

interface BuiltPart {
  name: string
  value: number
  highlight?: boolean
}

interface BuiltBar {
  label?: string
  parts: Array<BuiltPart>
}

function readPart(entry: JsonValue): BuiltPart | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const name = readTextField(entry, 'name')
  const rawValue = entry['value']

  if (name === null || rawValue === undefined || !isJsonNumber(rawValue)) {
    return null
  }

  const out: BuiltPart = { name, value: rawValue }

  if (entry['highlight'] === true) {
    out.highlight = true
  }

  return out
}

function readBar(entry: JsonValue): BuiltBar | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const partsRaw = readArrayField(entry, 'parts')

  if (partsRaw === null || partsRaw.length === 0) {
    return null
  }

  const parts: Array<BuiltPart> = []

  for (const raw of partsRaw) {
    const part = readPart(raw)

    if (part !== null) {
      parts.push(part)
    }
  }

  if (parts.length === 0) {
    return null
  }

  const out: BuiltBar = { parts }
  const label = readTextField(entry, 'label')

  if (label !== null) {
    out.label = label
  }

  return out
}

export interface ProportionBarBuilder {
  title?: string
  palette?: 'mono' | 'muted'
  readonly bars: Array<BuiltBar>
}

export function decodeProportionBarJson(record: {
  readonly [key: string]: JsonValue
}): ProportionBarInput | null {
  const barsRaw = readArrayField(record, 'bars')

  if (barsRaw === null || barsRaw.length === 0) {
    return null
  }

  const bars: Array<BuiltBar> = []

  for (const entry of barsRaw) {
    const bar = readBar(entry)

    if (bar !== null) {
      bars.push(bar)
    }
  }

  if (bars.length === 0) {
    return null
  }

  const out: ProportionBarBuilder = { bars }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  if (record['palette'] === 'muted') {
    out.palette = 'muted'
  }

  return out
}
