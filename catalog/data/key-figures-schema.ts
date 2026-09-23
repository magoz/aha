import { Schema } from 'effect'

/**
 * Wire schema for the key-figures component: two to six headline numbers
 * with labels, units, signed deltas and optional mini trends.
 */

export const KeyFigureSchema = Schema.Struct({
  label: Schema.String.annotate({ description: 'Figure label, e.g. median latency.' }),
  value: Schema.String.annotate({
    description: 'Preformatted headline value, e.g. 182 or 4.1.'
  }),
  unit: Schema.optional(Schema.String).annotate({
    description: 'Unit shown after the value, e.g. ms or %.'
  }),
  delta: Schema.optional(Schema.String).annotate({
    description: 'Signed change with its unit, e.g. +12 ms or -0.4 pts.'
  }),
  direction: Schema.optional(Schema.Literals(['up', 'down', 'flat'])).annotate({
    description: 'Delta arrow direction: up, down or flat. The sign carries the meaning.'
  }),
  trend: Schema.optional(Schema.Array(Schema.Number)).annotate({
    description: 'Recent values drawn as a mini sparkline, oldest first.'
  })
})

export const KeyFiguresSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the figures.'
  }),
  figures: Schema.Array(KeyFigureSchema).annotate({
    description: 'Two to six headline figures in display order.'
  })
})

export type KeyFiguresInput = (typeof KeyFiguresSchema)['Type']

export type KeyFigure = (typeof KeyFigureSchema)['Type']
