import type { JsonValue } from '../json-value.js'
import {
  isJsonRecord,
  isJsonText,
  readArrayField,
  readBooleanField,
  readTextField
} from '../shared/guards.js'
import type { StateDiagramInput } from './state-diagram-schema.js'

/**
 * Defensive browser-side reader for validated state-diagram JSON. The
 * build already decoded this block with Effect Schema; the client only
 * needs a total read so hand-edited markup cannot throw. Returns null
 * when the block is unusable.
 */

interface BuiltState {
  id: string
  label: string
  final?: boolean
}

interface BuiltTransition {
  from: string
  to: string
  label?: string
}

export interface StateDiagramBuilder {
  title?: string
  initial: string
  readonly states: Array<BuiltState>
  readonly transitions: Array<BuiltTransition>
  highlight?: Array<string>
}

function readState(entry: JsonValue): BuiltState | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const id = readTextField(entry, 'id')
  const label = readTextField(entry, 'label')

  if (id === null || label === null) {
    return null
  }

  const out: BuiltState = { id, label }

  if (readBooleanField(entry, 'final')) {
    out.final = true
  }

  return out
}

function readTransition(entry: JsonValue): BuiltTransition | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const from = readTextField(entry, 'from')
  const to = readTextField(entry, 'to')

  if (from === null || to === null) {
    return null
  }

  const label = readTextField(entry, 'label')
  const out: BuiltTransition = { from, to }

  if (label !== null) {
    out.label = label
  }

  return out
}

export function decodeStateDiagramJson(record: {
  readonly [key: string]: JsonValue
}): StateDiagramInput | null {
  const statesRaw = readArrayField(record, 'states')
  const transitionsRaw = readArrayField(record, 'transitions')
  const initial = readTextField(record, 'initial')

  if (statesRaw === null || transitionsRaw === null || initial === null || statesRaw.length === 0) {
    return null
  }

  const states: Array<BuiltState> = []

  for (const entry of statesRaw) {
    const state = readState(entry)

    if (state !== null) {
      states.push(state)
    }
  }

  if (states.length === 0) {
    return null
  }

  const transitions: Array<BuiltTransition> = []

  for (const entry of transitionsRaw) {
    const transition = readTransition(entry)

    if (transition !== null) {
      transitions.push(transition)
    }
  }

  const out: StateDiagramBuilder = { initial, states, transitions }

  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  const highlightRaw = readArrayField(record, 'highlight')

  if (highlightRaw !== null) {
    const highlight: Array<string> = []

    for (const entry of highlightRaw) {
      if (isJsonText(entry)) {
        highlight.push(entry)
      }
    }

    out.highlight = highlight
  }

  return out
}
