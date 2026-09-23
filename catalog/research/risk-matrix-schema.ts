import { Schema } from 'effect'

/**
 * Wire schema for the risk-matrix component: risks plotted as numbered
 * markers on a 5-by-5 likelihood/impact grid, with a mitigation and
 * owner list below.
 */

export const RiskLevelSchema = Schema.Union([
  Schema.Number,
  Schema.Literals(['low', 'medium', 'med', 'high'])
]).annotate({
  description:
    'Likelihood or impact: a number from 1 to 5, or low (= 1), med/medium (= 3), high (= 5).'
})

export const RiskSchema = Schema.Struct({
  title: Schema.String.annotate({
    description: 'Risk name, e.g. the gateway hostname loops back to the box.'
  }),
  likelihood: RiskLevelSchema.annotate({
    description: 'How likely the risk is: 1 to 5, or low, med/medium, high.'
  }),
  impact: RiskLevelSchema.annotate({
    description: 'How bad it is if it happens: 1 to 5, or low, med/medium, high.'
  }),
  mitigation: Schema.optional(Schema.String).annotate({
    description: 'What reduces it or caps the blast radius.'
  }),
  owner: Schema.optional(Schema.String).annotate({
    description: 'Who watches it, e.g. on-call or a name.'
  })
})

export const RiskMatrixSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the grid.'
  }),
  risks: Schema.Array(RiskSchema).annotate({
    description: 'Risks in display order; numbers follow this order.'
  })
})

export type RiskMatrixInput = (typeof RiskMatrixSchema)['Type']

export type RiskLevel = (typeof RiskLevelSchema)['Type']

export type Risk = (typeof RiskSchema)['Type']
