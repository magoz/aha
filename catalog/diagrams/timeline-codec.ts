import type { JsonValue } from '../json-value.js'
import {
  isJsonNumber,
  isJsonRecord,
  isJsonText,
  readArrayField,
  readBooleanField,
  readTextField
} from '../shared/guards.js'
import type { TimelineInput } from './timeline-schema.js'

/**
 * Defensive browser-side reader for validated timeline JSON. Timelines
 * are static, so this only serves tests and future clients; it stays
 * total and returns null when the block is unusable.
 */

interface BuiltPhase {
  label: string
  start: number | string
  end: number | string
  highlight?: boolean
}

interface BuiltMilestone {
  label: string
  date: number | string
}

export interface TimelineBuilder {
  title?: string
  readonly phases: Array<BuiltPhase>
  milestones?: Array<BuiltMilestone>
  today?: number | string
}

function readDate(raw: JsonValue | undefined): number | string | null {
  if (raw === undefined) {
    return null
  }

  if (isJsonNumber(raw) || isJsonText(raw)) {
    return raw
  }

  return null
}

function readPhase(entry: JsonValue): BuiltPhase | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const label = readTextField(entry, 'label')
  const start = readDate(entry['start'])
  const end = readDate(entry['end'])

  if (label === null || start === null || end === null) {
    return null
  }

  const out: BuiltPhase = { label, start, end }

  if (readBooleanField(entry, 'highlight')) {
    out.highlight = true
  }

  return out
}

function readMilestone(entry: JsonValue): BuiltMilestone | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const label = readTextField(entry, 'label')
  const date = readDate(entry['date'])

  if (label === null || date === null) {
    return null
  }

  return { label, date }
}

export function decodeTimelineJson(record: {
  readonly [key: string]: JsonValue
}): TimelineInput | null {
  const phasesRaw = readArrayField(record, 'phases')

  if (phasesRaw === null || phasesRaw.length === 0) {
    return null
  }

  const phases: Array<BuiltPhase> = []

  for (const entry of phasesRaw) {
    const phase = readPhase(entry)

    if (phase !== null) {
      phases.push(phase)
    }
  }

  if (phases.length === 0) {
    return null
  }

  const out: TimelineBuilder = { phases }

  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  const milestonesRaw = readArrayField(record, 'milestones')

  if (milestonesRaw !== null) {
    const milestones: Array<BuiltMilestone> = []

    for (const entry of milestonesRaw) {
      const milestone = readMilestone(entry)

      if (milestone !== null) {
        milestones.push(milestone)
      }
    }

    out.milestones = milestones
  }

  const today = readDate(record['today'])

  if (today !== null) {
    out.today = today
  }

  return out
}
