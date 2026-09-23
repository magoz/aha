import { Schema } from 'effect'

/**
 * Wire schema for the line-chart component. Field descriptions here are
 * the source of `aha components line-chart`; see catalog/fields.ts.
 */

export const NumberFormatSchema = Schema.Struct({
  style: Schema.optional(Schema.Literals(['decimal', 'currency', 'percent'])).annotate({
    description: 'Tick and tooltip number style: decimal, currency or percent.'
  }),
  currency: Schema.optional(Schema.String).annotate({
    description: 'ISO currency code for currency style, e.g. USD.'
  }),
  digits: Schema.optional(Schema.Number).annotate({
    description: 'Fixed fraction digits; omit for automatic precision.'
  })
})

export const LineChartPointSchema = Schema.Struct({
  x: Schema.Union([Schema.Number, Schema.String]).annotate({
    description: 'Horizontal value: number, ISO date for time x, or category label.'
  }),
  y: Schema.Union([Schema.Number, Schema.Null]).annotate({
    description: 'Vertical value; null leaves a gap in the line.'
  })
})

export const LineChartSeriesSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Series name, labelled directly on the plot.' }),
  highlight: Schema.optional(Schema.Boolean).annotate({
    description: 'Set on one series to draw it in the accent colour.'
  }),
  values: Schema.Array(LineChartPointSchema).annotate({
    description: 'Ordered points for this series.'
  })
})

export const LineChartXSchema = Schema.Struct({
  kind: Schema.Literals(['number', 'time', 'category']).annotate({
    description: 'Horizontal axis kind: number, time (ISO dates) or category.'
  }),
  label: Schema.optional(Schema.String).annotate({ description: 'Axis caption under the plot.' }),
  scale: Schema.optional(Schema.Literals(['linear', 'log'])).annotate({
    description: 'Number-axis scaling; log needs positive values.'
  }),
  format: Schema.optional(NumberFormatSchema).annotate({
    description: 'Number formatting for x tick labels.'
  })
})

export const LineChartYSchema = Schema.Struct({
  label: Schema.optional(Schema.String).annotate({ description: 'Axis caption beside the plot.' }),
  scale: Schema.optional(Schema.Literals(['linear', 'log'])).annotate({
    description: 'Vertical scaling; log needs positive values.'
  }),
  format: Schema.optional(NumberFormatSchema).annotate({
    description: 'Number formatting for y tick labels and tooltips.'
  })
})

export const LineChartSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the plot.'
  }),
  palette: Schema.optional(Schema.Literals(['mono', 'muted'])).annotate({
    description: 'Mono (default ink shades and dashes) or muted 6-colour palette.'
  }),
  x: LineChartXSchema.annotate({ description: 'Horizontal axis configuration.' }),
  y: Schema.optional(LineChartYSchema).annotate({ description: 'Vertical axis configuration.' }),
  series: Schema.Array(LineChartSeriesSchema).annotate({
    description: 'One entry per series; label them directly, no legend.'
  })
})

export type LineChartInput = (typeof LineChartSchema)['Type']

export type LineChartNumberFormat = (typeof NumberFormatSchema)['Type']
