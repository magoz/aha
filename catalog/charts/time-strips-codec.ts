import type { JsonValue } from '../json-value.js'
import {
  isJsonNumber,
  isJsonRecord,
  isJsonText,
  readArrayField,
  readTextField
} from '../shared/guards.js'
import type { TimeStripsInput } from './time-strips-schema.js'

/**
 * Defensive browser-side reader for validated time-strips JSON. Mirrors
 * line-chart-codec.ts: total read, null when unusable.
 */

type RowKind = 'line' | 'bars' | 'band' | 'line-bars' | 'line-band'

type Lane = 'ink' | 'blue'

function readKind(raw: JsonValue | undefined): RowKind | null {
  if (
    raw === 'line' ||
    raw === 'bars' ||
    raw === 'band' ||
    raw === 'line-bars' ||
    raw === 'line-band'
  ) {
    return raw
  }

  return null
}

function readLane(raw: JsonValue | undefined): Lane {
  if (raw === 'blue') {
    return 'blue'
  }

  return 'ink'
}

interface BuiltPoint {
  t: number | string
  v?: number | null
  m?: number | null
  lo?: number | null
  hi?: number | null
}

function readChannel(raw: JsonValue | undefined): number | null {
  if (raw === undefined || raw === null) {
    return null
  }

  if (!isJsonNumber(raw)) {
    return null
  }

  return raw
}

function readPoint(point: JsonValue): BuiltPoint | null {
  if (!isJsonRecord(point)) {
    return null
  }

  const rawT = point['t']

  if (rawT === undefined || rawT === null) {
    return null
  }

  const out: BuiltPoint = { t: 0 }

  if (isJsonNumber(rawT)) {
    out.t = rawT
  } else if (isJsonText(rawT)) {
    out.t = rawT
  } else {
    return null
  }

  const v = readChannel(point['v'])

  if (v !== null) {
    out.v = v
  }

  const m = readChannel(point['m'])

  if (m !== null) {
    out.m = m
  }

  const lo = readChannel(point['lo'])

  if (lo !== null) {
    out.lo = lo
  }

  const hi = readChannel(point['hi'])

  if (hi !== null) {
    out.hi = hi
  }

  return out
}

interface BuiltRow {
  label: string
  kind: RowKind
  unit?: string
  lane?: Lane
  points: Array<BuiltPoint>
}

export interface TimeStripsBuilder {
  title?: string
  start?: number | string
  end?: number | string
  readonly rows: Array<BuiltRow>
}

function readRow(entry: JsonValue): BuiltRow | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const label = readTextField(entry, 'label')
  const kind = readKind(entry['kind'])
  const pointsRaw = readArrayField(entry, 'points')

  if (label === null || kind === null || pointsRaw === null) {
    return null
  }

  const points: Array<BuiltPoint> = []

  for (const raw of pointsRaw) {
    const point = readPoint(raw)

    if (point !== null) {
      points.push(point)
    }
  }

  const out: BuiltRow = { label, kind, points }
  const unit = readTextField(entry, 'unit')

  if (unit !== null) {
    out.unit = unit
  }

  out.lane = readLane(entry['lane'])

  return out
}

export function decodeTimeStripsJson(record: {
  readonly [key: string]: JsonValue
}): TimeStripsInput | null {
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

  const out: TimeStripsBuilder = { rows }

  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  return out
}
