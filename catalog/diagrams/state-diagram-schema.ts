import { Schema } from 'effect'

/**
 * Wire schema for the state-diagram component. States and labelled
 * transitions laid out with the same engine as flow-diagram, plus an
 * initial state and double-bordered final states. Field descriptions
 * feed `aha components state-diagram`.
 */

export const StateNodeSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Stable state id referenced by transitions.' }),
  label: Schema.String.annotate({ description: 'State name drawn inside the box.' }),
  final: Schema.optional(Schema.Boolean).annotate({
    description: 'Final states get a double border.'
  })
})

export const StateTransitionSchema = Schema.Struct({
  from: Schema.String.annotate({ description: 'Source state id.' }),
  to: Schema.String.annotate({ description: 'Target state id.' }),
  label: Schema.optional(Schema.String).annotate({
    description: 'Event or guard drawn beside the arrow.'
  })
})

export const StateDiagramSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the diagram.'
  }),
  initial: Schema.String.annotate({
    description: 'State id where the start dot points.'
  }),
  states: Schema.Array(StateNodeSchema).annotate({
    description: 'States; every box carries a label.'
  }),
  transitions: Schema.Array(StateTransitionSchema).annotate({
    description: 'Labelled transitions between state ids.'
  }),
  highlight: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: 'State ids forming the highlighted path, drawn in the accent colour.'
  })
})

export type StateDiagramInput = (typeof StateDiagramSchema)['Type']
