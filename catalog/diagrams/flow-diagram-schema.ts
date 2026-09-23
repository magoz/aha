import { Schema } from 'effect'

/**
 * Wire schema for the flow-diagram component. A directed graph of
 * steps or services laid out automatically; the author never places
 * coordinates. Field descriptions feed `aha components flow-diagram`.
 */

export const FlowNodeSchema = Schema.Struct({
  id: Schema.String.annotate({
    description: 'Stable node id referenced by edges, groups and highlight.'
  }),
  label: Schema.String.annotate({ description: 'One-line label drawn inside the box.' }),
  group: Schema.optional(Schema.String).annotate({
    description: 'Group id; grouped nodes sit inside a labelled hairline box.'
  })
})

export const FlowEdgeSchema = Schema.Struct({
  from: Schema.String.annotate({ description: 'Source node id.' }),
  to: Schema.String.annotate({ description: 'Target node id.' }),
  label: Schema.optional(Schema.String).annotate({
    description: 'Short edge label drawn beside the arrow.'
  })
})

export const FlowGroupSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Group id referenced by nodes.' }),
  label: Schema.String.annotate({ description: 'Caption for the hairline group box.' })
})

export const FlowDiagramSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the diagram.'
  }),
  direction: Schema.optional(Schema.Literals(['auto', 'lr', 'tb'])).annotate({
    description: 'Layout direction; auto is left-to-right, top-to-bottom below 560px.'
  }),
  groups: Schema.optional(Schema.Array(FlowGroupSchema)).annotate({
    description: 'Optional clusters drawn as labelled hairline boxes.'
  }),
  nodes: Schema.Array(FlowNodeSchema).annotate({
    description: 'Steps or services; every box carries a label.'
  }),
  edges: Schema.Array(FlowEdgeSchema).annotate({
    description: 'Directed links between node ids, with optional labels.'
  }),
  highlight: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: 'Node ids forming the highlighted path, drawn in the accent colour.'
  })
})

export type FlowDiagramInput = (typeof FlowDiagramSchema)['Type']
