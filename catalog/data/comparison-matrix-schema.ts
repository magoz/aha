import { Schema } from 'effect'

/**
 * Wire schema for the comparison-matrix component: options across the top,
 * criteria down the side, typed cells, one optional recommended option.
 */

export const MatrixMarkCellSchema = Schema.Struct({
  mark: Schema.Literals(['yes', 'no', 'partial']).annotate({
    description: 'Support mark: yes, no or partial.'
  })
})

export const MatrixTextCellSchema = Schema.Struct({
  text: Schema.String.annotate({ description: 'Short text cell, e.g. a limit or caveat.' })
})

export const MatrixNumberCellSchema = Schema.Struct({
  value: Schema.Number.annotate({ description: 'Numeric cell value.' }),
  unit: Schema.optional(Schema.String).annotate({
    description: 'Unit shown after the number, e.g. ms.'
  })
})

export const MatrixCellSchema = Schema.Union([
  MatrixMarkCellSchema,
  MatrixTextCellSchema,
  MatrixNumberCellSchema
]).annotate({
  description: 'One cell: a yes/no/partial mark, short text, or a number with unit.'
})

export const MatrixOptionSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Option name shown in the header row.' }),
  recommended: Schema.optional(Schema.Boolean).annotate({
    description: 'Set on one option to draw its column in the accent.'
  })
})

export const MatrixRowSchema = Schema.Struct({
  criterion: Schema.String.annotate({ description: 'Criterion label for the first column.' }),
  cells: Schema.Array(MatrixCellSchema).annotate({
    description: 'One cell per option, in header order.'
  })
})

export const ComparisonMatrixSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the matrix.'
  }),
  options: Schema.Array(MatrixOptionSchema).annotate({
    description:
      'Options across the top, in display order; one option may set recommended for the accent column.'
  }),
  rows: Schema.Array(MatrixRowSchema).annotate({
    description: 'One row per criterion, each holding one typed cell per option.'
  })
})

export type ComparisonMatrixInput = (typeof ComparisonMatrixSchema)['Type']

export type MatrixCell = (typeof MatrixCellSchema)['Type']
