import { Schema } from 'effect'

/**
 * Wire schema for the sparkline component. A tiny inline trend for use
 * inside prose or tables, with an optional last value and min/max markers.
 */

export const SparkNumberFormatSchema = Schema.Struct({
  style: Schema.optional(Schema.Literals(['decimal', 'currency', 'percent'])).annotate({
    description: 'Number style for the last value and hover tooltips.'
  }),
  currency: Schema.optional(Schema.String).annotate({
    description: 'ISO currency code for currency style, e.g. USD.'
  }),
  digits: Schema.optional(Schema.Number).annotate({
    description: 'Fixed fraction digits; omit for automatic precision.'
  })
})

export const SparklineSchema = Schema.Struct({
  label: Schema.optional(Schema.String).annotate({
    description: 'Short label read by assistive tech and shown before the last value.'
  }),
  values: Schema.Array(Schema.Union([Schema.Number, Schema.Null])).annotate({
    description: 'The trend, oldest to newest; null leaves a gap.'
  }),
  showLast: Schema.optional(Schema.Boolean).annotate({
    description: 'Show the last value as text after the spark; on by default.'
  }),
  markExtremes: Schema.optional(Schema.Boolean).annotate({
    description: 'Dot the minimum and maximum points; on by default.'
  }),
  format: Schema.optional(SparkNumberFormatSchema).annotate({
    description: 'Number formatting for the last value and tooltips.'
  })
})

export type SparklineInput = (typeof SparklineSchema)['Type']
