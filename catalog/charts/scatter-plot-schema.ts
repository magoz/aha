import { Schema } from 'effect'

/**
 * Wire schema for the scatter-plot component. X/y points with optional
 * size and group encodings, labels on selected points, an optional least
 * squares trend line, and log axes.
 */

export const ScatterNumberFormatSchema = Schema.Struct({
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

export const ScatterAxisSchema = Schema.Struct({
  label: Schema.optional(Schema.String).annotate({ description: 'Axis caption.' }),
  scale: Schema.optional(Schema.Literals(['linear', 'log'])).annotate({
    description: 'Axis scaling; log needs positive values.'
  }),
  format: Schema.optional(ScatterNumberFormatSchema).annotate({
    description: 'Number formatting for tick labels and tooltips.'
  })
})

export const ScatterPointSchema = Schema.Struct({
  x: Schema.Number.annotate({ description: 'Horizontal value.' }),
  y: Schema.Union([Schema.Number, Schema.Null]).annotate({
    description: 'Vertical value; null skips the point.'
  }),
  label: Schema.optional(Schema.String).annotate({
    description: 'Direct label drawn next to this point; use sparingly.'
  }),
  group: Schema.optional(Schema.String).annotate({
    description: 'Group name; groups get distinct shades, dashes and glyphs.'
  }),
  size: Schema.optional(Schema.Number).annotate({
    description: 'Size encoding; circle area scales with this value.'
  })
})

export const ScatterPlotSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short chart title shown above the plot.'
  }),
  palette: Schema.optional(Schema.Literals(['mono', 'muted'])).annotate({
    description: 'Mono (default ink shades) or muted 6-colour palette.'
  }),
  trend: Schema.optional(Schema.Boolean).annotate({
    description: 'Draw a least squares trend line through the points.'
  }),
  x: Schema.optional(ScatterAxisSchema).annotate({ description: 'Horizontal axis configuration.' }),
  y: Schema.optional(ScatterAxisSchema).annotate({ description: 'Vertical axis configuration.' }),
  points: Schema.Array(ScatterPointSchema).annotate({
    description: 'The observations; label only the points worth naming.'
  })
})

export type ScatterPlotInput = (typeof ScatterPlotSchema)['Type']
