import { Schema } from 'effect'

/**
 * Wire schema for the fact-set component: a compact key-value spec
 * sheet with optional groups and muted mono units.
 */

export const FactItemSchema = Schema.Struct({
  key: Schema.String.annotate({ description: 'Fact label, e.g. sample rate.' }),
  value: Schema.String.annotate({ description: 'Preformatted value, e.g. 48 or line-level.' }),
  unit: Schema.optional(Schema.String).annotate({
    description: 'Unit shown after the value in muted mono, e.g. kHz or h.'
  }),
  note: Schema.optional(Schema.String).annotate({
    description: 'Small muted note under the value.'
  })
})

export const FactGroupSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Group name, e.g. power.' }),
  items: Schema.Array(FactItemSchema).annotate({
    description: 'Facts in this group, in display order.'
  })
})

export const FactSetSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the sheet.'
  }),
  items: Schema.optional(Schema.Array(FactItemSchema)).annotate({
    description: 'Ungrouped facts in display order. Use items, groups, or both.'
  }),
  groups: Schema.optional(Schema.Array(FactGroupSchema)).annotate({
    description: 'Named fact groups in display order. Use items, groups, or both.'
  })
})

export type FactSetInput = (typeof FactSetSchema)['Type']

export type FactItem = (typeof FactItemSchema)['Type']

export type FactGroup = (typeof FactGroupSchema)['Type']
