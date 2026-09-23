import { Schema } from 'effect'

/**
 * Wire schema for the area-chart component. Stacked or overlapping areas
 * over a numeric or time axis, with an optional 100% normalisation.
 */

export const AreaNumberFormatSchema = Schema.Struct({
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

export const AreaPointSchema = Schema.Struct({
  x: Schema.Union([Schema.Number, Schema.String]).annotate({
    description: 'Horizontal value: number, or ISO date for time x.'
  }),
  y: Schema.Union([Schema.Number, Schema.Null]).annotate({
    description: 'Vertical value; null leaves a gap in the area.'
  })
})

export const AreaSeriesSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Series name, labelled directly on the plot.' }),
  highlight: Schema.optional(Schema.Boolean).annotate({
    description: 'Set on one series to draw it in the accent colour.'
  }),
  values: Schema.Array(AreaPointSchema).annotate({
    description: 'Ordered points for this series.'
  })
})

export const AreaChartSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the plot.'
  }),
  mode: Schema.optional(Schema.Literals(['stacked', 'overlap'])).annotate({
    description: 'Stacked areas that sum, or overlapping translucent areas.'
  }),
  percent: Schema.optional(Schema.Boolean).annotate({
    description: 'Normalise each x to 100% so the chart shows shares, not totals.'
  }),
  palette: Schema.optional(Schema.Literals(['mono', 'muted'])).annotate({
    description: 'Mono (default ink shades) or muted 6-colour palette.'
  }),
  x: Schema.Struct({
    kind: Schema.Literals(['number', 'time']).annotate({
      description: 'Horizontal axis kind: number or time (ISO dates).'
    }),
    label: Schema.optional(Schema.String).annotate({ description: 'Axis caption under the plot.' })
  }).annotate({ description: 'Horizontal axis configuration.' }),
  y: Schema.optional(
    Schema.Struct({
      label: Schema.optional(Schema.String).annotate({
        description: 'Axis caption beside the plot.'
      }),
      format: Schema.optional(AreaNumberFormatSchema).annotate({
        description: 'Number formatting for y tick labels and tooltips.'
      })
    })
  ).annotate({ description: 'Vertical axis configuration.' }),
  series: Schema.Array(AreaSeriesSchema).annotate({
    description: 'One entry per series; label them directly, no legend.'
  })
})

export type AreaChartInput = (typeof AreaChartSchema)['Type']
