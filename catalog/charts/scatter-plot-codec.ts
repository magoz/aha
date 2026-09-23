import type { JsonValue } from '../json-value.js'
import {
  isJsonNumber,
  isJsonRecord,
  readArrayField,
  readBooleanField,
  readTextField
} from '../shared/guards.js'
import type { ScatterPlotInput } from './scatter-plot-schema.js'

/**
 * Defensive browser-side reader for validated scatter-plot JSON. Total
 * read, null when unusable.
 */

interface BuiltPoint {
  x: number
  y: number | null
  label?: string
  group?: string
  size?: number
}

function readPoint(point: JsonValue): BuiltPoint | null {
  if (!isJsonRecord(point)) {
    return null
  }

  const rawX = point['x']

  if (rawX === undefined || !isJsonNumber(rawX)) {
    return null
  }

  const out: BuiltPoint = { x: rawX, y: null }
  const rawY = point['y']

  if (rawY !== undefined && rawY !== null) {
    if (!isJsonNumber(rawY)) {
      return null
    }

    out.y = rawY
  }

  const label = readTextField(point, 'label')

  if (label !== null) {
    out.label = label
  }

  const group = readTextField(point, 'group')

  if (group !== null) {
    out.group = group
  }

  const size = point['size']

  if (size !== undefined && isJsonNumber(size)) {
    out.size = size
  }

  return out
}

export interface ScatterPlotBuilder {
  title?: string
  palette?: 'mono' | 'muted'
  trend?: boolean
  readonly points: Array<BuiltPoint>
}

export function decodeScatterPlotJson(record: {
  readonly [key: string]: JsonValue
}): ScatterPlotInput | null {
  const pointsRaw = readArrayField(record, 'points')

  if (pointsRaw === null || pointsRaw.length === 0) {
    return null
  }

  const points: Array<BuiltPoint> = []

  for (const raw of pointsRaw) {
    const point = readPoint(raw)

    if (point !== null) {
      points.push(point)
    }
  }

  if (points.length === 0) {
    return null
  }

  const out: ScatterPlotBuilder = { points }
  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  if (record['palette'] === 'muted') {
    out.palette = 'muted'
  }

  if (readBooleanField(record, 'trend')) {
    out.trend = true
  }

  return out
}
