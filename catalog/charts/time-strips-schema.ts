import { Schema } from 'effect'

/**
 * Wire schema for the time-strips component: stacked rows sharing one time
 * axis, each with its own small scale. Rain-style rows use the blue lane,
 * never the warning colour.
 */

export const StripNumberFormatSchema = Schema.Struct({
  style: Schema.optional(Schema.Literals(['decimal', 'currency', 'percent'])).annotate({
    description: 'Tick and tooltip number style.'
  }),
  currency: Schema.optional(Schema.String).annotate({
    description: 'ISO currency code for currency style.'
  }),
  digits: Schema.optional(Schema.Number).annotate({
    description: 'Fixed fraction digits; omit for automatic precision.'
  })
})

export const StripPointSchema = Schema.Struct({
  t: Schema.Union([Schema.Number, Schema.String]).annotate({
    description: 'Timestamp: ISO date string or epoch milliseconds.'
  }),
  v: Schema.optional(Schema.Union([Schema.Number, Schema.Null])).annotate({
    description: 'Line value; null leaves a gap.'
  }),
  m: Schema.optional(Schema.Union([Schema.Number, Schema.Null])).annotate({
    description: 'Bar amount for bars and line-bars rows.'
  }),
  lo: Schema.optional(Schema.Union([Schema.Number, Schema.Null])).annotate({
    description: 'Band lower edge for band and line-band rows.'
  }),
  hi: Schema.optional(Schema.Union([Schema.Number, Schema.Null])).annotate({
    description: 'Band upper edge for band and line-band rows.'
  })
})

export const StripRowSchema = Schema.Struct({
  label: Schema.String.annotate({ description: 'Row label, e.g. Temperature.' }),
  kind: Schema.Literals(['line', 'bars', 'band', 'line-bars', 'line-band']).annotate({
    description: 'Which channels this row draws: a line, bars, a band, or a combination.'
  }),
  unit: Schema.optional(Schema.String).annotate({
    description: 'Unit caption for the row, e.g. °C, %, mm, km/h.'
  }),
  lane: Schema.optional(Schema.Literals(['ink', 'blue'])).annotate({
    description: 'Ink lane by default; blue for rain and water rows. Never warning red.'
  }),
  format: Schema.optional(StripNumberFormatSchema).annotate({
    description: 'Number formatting for this row.'
  }),
  points: Schema.Array(StripPointSchema).annotate({
    description: 'Ordered observations for this row.'
  })
})

export const TimeStripsSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the rows.'
  }),
  start: Schema.optional(Schema.Union([Schema.Number, Schema.String])).annotate({
    description: 'Axis start; defaults to the earliest point.'
  }),
  end: Schema.optional(Schema.Union([Schema.Number, Schema.String])).annotate({
    description: 'Axis end; defaults to the latest point.'
  }),
  rows: Schema.Array(StripRowSchema).annotate({
    description: 'Stacked rows sharing one time axis.'
  })
})

export type TimeStripsInput = (typeof TimeStripsSchema)['Type']

export type StripRowInput = (typeof StripRowSchema)['Type']
