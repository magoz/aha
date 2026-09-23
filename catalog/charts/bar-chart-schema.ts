import { Schema } from 'effect'

/**
 * Wire schema for the bar-chart component. Vertical or horizontal, grouped
 * or stacked, with negatives diverging from zero. Field descriptions are
 * the source of `aha components bar-chart`.
 */

export const BarNumberFormatSchema = Schema.Struct({
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

export const BarSeriesSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Series name, labelled directly on the plot.' }),
  highlight: Schema.optional(Schema.Boolean).annotate({
    description: 'Set on one series to draw it in the accent colour.'
  }),
  values: Schema.Array(Schema.Union([Schema.Number, Schema.Null])).annotate({
    description: 'One value per category, in category order; null skips the bar.'
  })
})

export const BarReferenceSchema = Schema.Struct({
  value: Schema.Number.annotate({
    description: 'Value on the value axis where the line is drawn.'
  }),
  label: Schema.optional(Schema.String).annotate({
    description: 'Line caption shown beside the plot edge; defaults to the value.'
  })
})

export const BarChartSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the plot.'
  }),
  orientation: Schema.optional(Schema.Literals(['vertical', 'horizontal'])).annotate({
    description: 'Bar direction; vertical by default, horizontal reads better for long labels.'
  }),
  mode: Schema.optional(Schema.Literals(['grouped', 'stacked'])).annotate({
    description: 'Grouped side-by-side bars, or stacked segments per category.'
  }),
  sorted: Schema.optional(Schema.Literals(['none', 'asc', 'desc'])).annotate({
    description: 'Reorder categories by their total: none keeps input order.'
  }),
  palette: Schema.optional(Schema.Literals(['mono', 'muted'])).annotate({
    description: 'Mono (default ink shades) or muted 6-colour palette.'
  }),
  categories: Schema.Array(Schema.String).annotate({
    description: 'Category labels along the category axis, in input order.'
  }),
  format: Schema.optional(BarNumberFormatSchema).annotate({
    description: 'Number formatting for value ticks, labels and tooltips.'
  }),
  series: Schema.Array(BarSeriesSchema).annotate({
    description: 'One entry per series; every values array must match categories in length.'
  }),
  references: Schema.optional(Schema.Array(BarReferenceSchema)).annotate({
    description: 'Optional reference lines (1 to 3) on the value axis, e.g. a legal limit.'
  })
})

export type BarChartInput = (typeof BarChartSchema)['Type']
