import { Schema } from 'effect'

/**
 * Wire schema for the timeline component. Phases as span bars and
 * milestones as diamonds on one date axis, with an optional today
 * marker. Field descriptions feed `aha components timeline`.
 */

export const TimelinePhaseSchema = Schema.Struct({
  label: Schema.String.annotate({ description: 'Phase name; wraps inside or beside the bar.' }),
  start: Schema.Union([Schema.Number, Schema.String]).annotate({
    description: 'Phase start: ISO date or epoch millis.'
  }),
  end: Schema.Union([Schema.Number, Schema.String]).annotate({
    description: 'Phase end: ISO date or epoch millis.'
  }),
  highlight: Schema.optional(Schema.Boolean).annotate({
    description: 'Set on one phase to draw its bar in the accent colour.'
  })
})

export const TimelineMilestoneSchema = Schema.Struct({
  label: Schema.String.annotate({ description: 'Milestone name drawn under the diamond.' }),
  date: Schema.Union([Schema.Number, Schema.String]).annotate({
    description: 'Milestone date: ISO date or epoch millis.'
  })
})

export const TimelineSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the timeline.'
  }),
  phases: Schema.Array(TimelinePhaseSchema).annotate({
    description: 'Span bars, one row each, in date order.'
  }),
  milestones: Schema.optional(Schema.Array(TimelineMilestoneSchema)).annotate({
    description: 'Diamonds on the milestone lane below the phases.'
  }),
  today: Schema.optional(Schema.Union([Schema.Number, Schema.String])).annotate({
    description: 'Optional today marker drawn as a dashed line.'
  })
})

export type TimelineInput = (typeof TimelineSchema)['Type']
