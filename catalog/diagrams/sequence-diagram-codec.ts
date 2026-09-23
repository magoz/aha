import type { JsonValue } from '../json-value.js'
import {
  isJsonRecord,
  readArrayField,
  readBooleanField,
  readNumberField,
  readTextField
} from '../shared/guards.js'
import type { SequenceDiagramInput } from './sequence-diagram-schema.js'

/**
 * Defensive browser-side reader for validated sequence-diagram JSON. The
 * build already decoded this block with Effect Schema; the client only
 * needs a total read so hand-edited markup cannot throw. Returns null
 * when the block is unusable.
 */

interface BuiltActor {
  id: string
  label: string
}

interface BuiltMessage {
  from: string
  to: string
  label: string
  kind?: 'sync' | 'async' | 'return'
  highlight?: boolean
}

interface BuiltNote {
  text: string
  actor?: string
  after?: number
}

export interface SequenceDiagramBuilder {
  title?: string
  readonly actors: Array<BuiltActor>
  readonly messages: Array<BuiltMessage>
  notes?: Array<BuiltNote>
}

function readActor(entry: JsonValue): BuiltActor | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const id = readTextField(entry, 'id')
  const label = readTextField(entry, 'label')

  if (id === null || label === null) {
    return null
  }

  return { id, label }
}

function readKind(raw: JsonValue | undefined): 'sync' | 'async' | 'return' | undefined {
  if (raw === 'async' || raw === 'return' || raw === 'sync') {
    return raw
  }

  return undefined
}

function readMessage(entry: JsonValue): BuiltMessage | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const from = readTextField(entry, 'from')
  const to = readTextField(entry, 'to')
  const label = readTextField(entry, 'label')

  if (from === null || to === null || label === null) {
    return null
  }

  const out: BuiltMessage = { from, to, label }
  const kind = readKind(entry['kind'])

  if (kind !== undefined) {
    out.kind = kind
  }

  if (readBooleanField(entry, 'highlight')) {
    out.highlight = true
  }

  return out
}

function readNote(entry: JsonValue): BuiltNote | null {
  if (!isJsonRecord(entry)) {
    return null
  }

  const text = readTextField(entry, 'text')

  if (text === null) {
    return null
  }

  const out: BuiltNote = { text }
  const actor = readTextField(entry, 'actor')

  if (actor !== null) {
    out.actor = actor
  }

  const after = readNumberField(entry, 'after')

  if (after !== null) {
    out.after = after
  }

  return out
}

export function decodeSequenceDiagramJson(record: {
  readonly [key: string]: JsonValue
}): SequenceDiagramInput | null {
  const actorsRaw = readArrayField(record, 'actors')
  const messagesRaw = readArrayField(record, 'messages')

  if (actorsRaw === null || messagesRaw === null) {
    return null
  }

  if (actorsRaw.length < 2 || messagesRaw.length === 0) {
    return null
  }

  const actors: Array<BuiltActor> = []

  for (const entry of actorsRaw) {
    const actor = readActor(entry)

    if (actor !== null) {
      actors.push(actor)
    }
  }

  const messages: Array<BuiltMessage> = []

  for (const entry of messagesRaw) {
    const message = readMessage(entry)

    if (message !== null) {
      messages.push(message)
    }
  }

  if (actors.length < 2 || messages.length === 0) {
    return null
  }

  const out: SequenceDiagramBuilder = { actors, messages }

  const title = readTextField(record, 'title')

  if (title !== null) {
    out.title = title
  }

  const notesRaw = readArrayField(record, 'notes')

  if (notesRaw !== null) {
    const notes: Array<BuiltNote> = []

    for (const entry of notesRaw) {
      const note = readNote(entry)

      if (note !== null) {
        notes.push(note)
      }
    }

    out.notes = notes
  }

  return out
}
