import { Schema } from 'effect'

/**
 * Wire schema for the heatmap component. A matrix of values over two
 * categorical axes (e.g. hour by weekday) with a sequential ink scale, a
 * scale legend and per-cell tooltips.
 */

export const HeatNumberFormatSchema = Schema.Struct({
  style: Schema.optional(Schema.Literals(['decimal', 'currency', 'percent'])).annotate({
    description: 'Number style for cell labels, legend and tooltips.'
  }),
  currency: Schema.optional(Schema.String).annotate({
    description: 'ISO currency code for currency style, e.g. USD.'
  }),
  digits: Schema.optional(Schema.Number).annotate({
    description: 'Fixed fraction digits; omit for automatic precision.'
  })
})

export const HeatmapSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the grid.'
  }),
  rows: Schema.Array(Schema.String).annotate({
    description: 'Row labels, top to bottom, e.g. weekdays.'
  }),
  columns: Schema.Array(Schema.String).annotate({
    description: 'Column labels, left to right, e.g. time blocks.'
  }),
  values: Schema.Array(Schema.Array(Schema.Union([Schema.Number, Schema.Null]))).annotate({
    description: 'One row per entry in rows, one value per column; null leaves a cell empty.'
  }),
  format: Schema.optional(HeatNumberFormatSchema).annotate({
    description: 'Number formatting for cells, legend and tooltips.'
  })
})

export type HeatmapInput = (typeof HeatmapSchema)['Type']
