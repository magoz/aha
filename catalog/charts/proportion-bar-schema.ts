import { Schema } from 'effect'

/**
 * Wire schema for the proportion-bar component. One 100% bar or a small
 * set of them showing parts of a whole, labelled directly: a stand-in for
 * pie charts.
 */

export const ProportionPartSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Part name, labelled directly on the bar.' }),
  value: Schema.Number.annotate({ description: 'Part size; shares are value over the bar total.' }),
  highlight: Schema.optional(Schema.Boolean).annotate({
    description: 'Draw this part in the accent colour.'
  })
})

export const ProportionBarRowSchema = Schema.Struct({
  label: Schema.optional(Schema.String).annotate({
    description: 'Bar label for sets of bars, e.g. the year.'
  }),
  parts: Schema.Array(ProportionPartSchema).annotate({
    description: 'The parts of this whole; values must be zero or more and sum above zero.'
  })
})

export const ProportionBarSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the bars.'
  }),
  palette: Schema.optional(Schema.Literals(['mono', 'muted'])).annotate({
    description: 'Mono (default ink shades) or muted 6-colour palette.'
  }),
  bars: Schema.Array(ProportionBarRowSchema).annotate({
    description: 'One 100% bar, or a small set for comparison.'
  })
})

export type ProportionBarInput = (typeof ProportionBarSchema)['Type']
