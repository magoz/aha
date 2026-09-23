import { Schema } from 'effect'

/**
 * Wire schema for the sequence-diagram component. Actors as lifelines
 * with ordered messages between them; layout is automatic, newest rows
 * at the bottom. Field descriptions feed `aha components sequence-diagram`.
 */

export const SequenceActorSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Stable actor id referenced by messages.' }),
  label: Schema.String.annotate({ description: 'Actor name drawn in the header box.' })
})

export const SequenceMessageSchema = Schema.Struct({
  from: Schema.String.annotate({ description: 'Sending actor id.' }),
  to: Schema.String.annotate({ description: 'Receiving actor id.' }),
  label: Schema.String.annotate({ description: 'Message label drawn above the arrow.' }),
  kind: Schema.optional(Schema.Literals(['sync', 'async', 'return'])).annotate({
    description: 'Arrow style: sync (default), async (open head) or return (dashed).'
  }),
  highlight: Schema.optional(Schema.Boolean).annotate({
    description: 'Set on one message to draw it in the accent colour.'
  })
})

export const SequenceNoteSchema = Schema.Struct({
  text: Schema.String.annotate({ description: 'Note text drawn in a hairline box.' }),
  actor: Schema.optional(Schema.String).annotate({
    description: 'Actor id the note sits over; omit to span all actors.'
  }),
  after: Schema.optional(Schema.Number).annotate({
    description: 'Message count after which the note sits; defaults to the end.'
  })
})

export const SequenceDiagramSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the diagram.'
  }),
  actors: Schema.Array(SequenceActorSchema).annotate({
    description: 'Lifelines in left-to-right order; keep few enough to fit.'
  }),
  messages: Schema.Array(SequenceMessageSchema).annotate({
    description: 'Ordered messages, top to bottom.'
  }),
  notes: Schema.optional(Schema.Array(SequenceNoteSchema)).annotate({
    description: 'Optional notes pinned after a message count.'
  })
})

export type SequenceDiagramInput = (typeof SequenceDiagramSchema)['Type']
