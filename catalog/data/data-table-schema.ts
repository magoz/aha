import { Schema } from 'effect'

/**
 * Wire schema for the data-table component: typed columns, optional
 * sortable headers, optional highlighted row, collapse past a threshold.
 */

export const DataTableColumnSchema = Schema.Struct({
  key: Schema.String.annotate({ description: 'Cell key used by each row.' }),
  label: Schema.optional(Schema.String).annotate({
    description: 'Header text; defaults to the key.'
  }),
  type: Schema.Literals(['text', 'number', 'currency', 'percent', 'date']).annotate({
    description: 'Column type: text, number, currency, percent or date.'
  }),
  currency: Schema.optional(Schema.String).annotate({
    description: 'ISO currency code for currency columns.'
  }),
  digits: Schema.optional(Schema.Number).annotate({
    description: 'Fixed fraction digits; omit for automatic precision.'
  })
})

export const DataTableCellSchema = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null
])

export const DataTableRowSchema = Schema.Array(DataTableCellSchema)

export const DataTableSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the table.'
  }),
  columns: Schema.Array(DataTableColumnSchema).annotate({
    description: 'Column definitions in display order.'
  }),
  rows: Schema.Array(DataTableRowSchema).annotate({
    description: 'One array of cells per row, aligned with columns.'
  }),
  sortable: Schema.optional(Schema.Boolean).annotate({
    description: 'Make headers sort the table in the browser.'
  }),
  highlightRow: Schema.optional(Schema.Number).annotate({
    description: 'Zero-based row index drawn with the accent edge.'
  }),
  collapseAfter: Schema.optional(Schema.Number).annotate({
    description: 'Hide rows past this count behind a details element; default 12.'
  })
})

export type DataTableInput = (typeof DataTableSchema)['Type']

export type DataTableCell = (typeof DataTableCellSchema)['Type']
