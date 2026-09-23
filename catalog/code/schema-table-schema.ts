import { Schema } from 'effect'

/**
 * Wire schema for the schema-table component: field lists with names,
 * types, requirement, defaults, descriptions and examples. Nested
 * objects and arrays nest through the `fields` child list.
 */

export interface SchemaTableField {
  readonly name: string
  readonly type: string
  readonly required?: boolean | undefined
  readonly default?: string | undefined
  readonly description?: string | undefined
  readonly example?: string | undefined
  readonly fields?: ReadonlyArray<SchemaTableField> | undefined
}

export const SchemaTableFieldSchema: Schema.Codec<SchemaTableField> = Schema.suspend(
  (): Schema.Codec<SchemaTableField> =>
    Schema.Struct({
      name: Schema.String.annotate({
        description: 'Field name without dots, e.g. maxBytes. Nesting builds the dotted path.'
      }),
      type: Schema.String.annotate({
        description: 'Type label, e.g. string, number, boolean or object.'
      }),
      required: Schema.optional(Schema.Boolean).annotate({
        description: 'True when the field must be present; defaults to optional.'
      }),
      default: Schema.optional(Schema.String).annotate({
        description: 'Default value when omitted, formatted as it appears on the wire.'
      }),
      description: Schema.optional(Schema.String).annotate({
        description: 'What the field means, in one sentence.'
      }),
      example: Schema.optional(Schema.String).annotate({
        description: 'Example value, formatted as it appears on the wire.'
      }),
      fields: Schema.optional(Schema.Array(SchemaTableFieldSchema)).annotate({
        description: 'Child fields for objects and arrays; rendered under the dotted path.'
      })
    })
)

export const SchemaTableSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the table, e.g. POST /api/ahas.'
  }),
  fields: Schema.Array(SchemaTableFieldSchema).annotate({
    description: 'Top-level fields in display order; nesting builds dotted paths.'
  })
})

export type SchemaTableInput = (typeof SchemaTableSchema)['Type']
