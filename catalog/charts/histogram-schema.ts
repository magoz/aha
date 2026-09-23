import { Schema } from 'effect'

/**
 * Wire schema for the histogram component. A binned distribution with
 * automatic nice bins and an optional marker line, e.g. the median.
 */

export const HistogramNumberFormatSchema = Schema.Struct({
  style: Schema.optional(Schema.Literals(['decimal', 'currency', 'percent'])).annotate({
    description: 'Number style for bin edges and tooltips.'
  }),
  currency: Schema.optional(Schema.String).annotate({
    description: 'ISO currency code for currency style, e.g. USD.'
  }),
  digits: Schema.optional(Schema.Number).annotate({
    description: 'Fixed fraction digits; omit for automatic precision.'
  })
})

export const HistogramMarkerSchema = Schema.Struct({
  value: Schema.Number.annotate({ description: 'Where to draw the marker line.' }),
  label: Schema.optional(Schema.String).annotate({
    description: 'Marker caption, e.g. median; defaults to the value.'
  })
})

export const HistogramSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the plot.'
  }),
  label: Schema.optional(Schema.String).annotate({
    description: 'Axis caption for the measured value, e.g. latency (ms).'
  }),
  bins: Schema.optional(Schema.Number).annotate({
    description: 'Target bin count; omit for an automatic choice.'
  }),
  marker: Schema.optional(HistogramMarkerSchema).annotate({
    description: 'Optional marker line, e.g. the median or a budget.'
  }),
  format: Schema.optional(HistogramNumberFormatSchema).annotate({
    description: 'Number formatting for bin edges and tooltips.'
  }),
  values: Schema.Array(Schema.Number).annotate({
    description: 'The raw observations; binning is automatic and nice.'
  })
})

export type HistogramInput = (typeof HistogramSchema)['Type']
