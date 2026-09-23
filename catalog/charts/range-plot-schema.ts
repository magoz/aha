import { Schema } from 'effect'

/**
 * Wire schema for the range-plot component. A dumbbell per category:
 * before and after (or min and max) with the change highlighted.
 */

export const RangeNumberFormatSchema = Schema.Struct({
  style: Schema.optional(Schema.Literals(['decimal', 'currency', 'percent'])).annotate({
    description: 'Number style for the axis, change labels and tooltips.'
  }),
  currency: Schema.optional(Schema.String).annotate({
    description: 'ISO currency code for currency style, e.g. USD.'
  }),
  digits: Schema.optional(Schema.Number).annotate({
    description: 'Fixed fraction digits; omit for automatic precision.'
  })
})

export const RangeRowSchema = Schema.Struct({
  label: Schema.String.annotate({ description: 'Category label for this row.' }),
  a: Schema.Number.annotate({ description: 'First value: the before, or the minimum.' }),
  b: Schema.Number.annotate({ description: 'Second value: the after, or the maximum.' }),
  highlight: Schema.optional(Schema.Boolean).annotate({
    description: 'Draw this row in the accent colour to call out its change.'
  })
})

export const RangePlotSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the plot.'
  }),
  fromLabel: Schema.optional(Schema.String).annotate({
    description: 'Caption for the first dot, e.g. before; shown in the details table.'
  }),
  toLabel: Schema.optional(Schema.String).annotate({
    description: 'Caption for the second dot, e.g. after; shown in the details table.'
  }),
  format: Schema.optional(RangeNumberFormatSchema).annotate({
    description: 'Number formatting for the axis, change labels and tooltips.'
  }),
  rows: Schema.Array(RangeRowSchema).annotate({
    description: 'One dumbbell per category, in input order.'
  })
})

export type RangePlotInput = (typeof RangePlotSchema)['Type']
