import { Schema } from 'effect'

/**
 * Wire schema for the scalable-list component: quantities written for a
 * base yield, rescaled live by a small control. Rounding follows the
 * unit; null quantities (to taste) never scale.
 */

export const ScalableListItemSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Ingredient name, e.g. waxy potatoes.' }),
  qty: Schema.Union([Schema.Number, Schema.Null]).annotate({
    description: 'Base quantity for the base yield; null means to taste and never scales.'
  }),
  unit: Schema.optional(Schema.String).annotate({
    description: 'Unit: g, kg, ml, l, tsp, tbsp, pcs or eggs. Rounding follows the unit.'
  }),
  note: Schema.optional(Schema.String).annotate({
    description: 'Preparation note, e.g. thinly sliced.'
  }),
  whole: Schema.optional(Schema.Boolean).annotate({
    description: 'Round to whole pieces with a minimum of 1, e.g. for onions.'
  })
})

export const ScalableListSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the list, e.g. the dish name.'
  }),
  serves: Schema.Number.annotate({
    description: 'Base yield the quantities are written for, e.g. 4.'
  }),
  servesLabel: Schema.optional(Schema.String).annotate({
    description: 'Yield label shown after the number. Defaults to servings.'
  }),
  presets: Schema.optional(Schema.Array(Schema.Number)).annotate({
    description: 'Preset yield buttons, e.g. 2, 4 and 8.'
  }),
  items: Schema.Array(ScalableListItemSchema).annotate({
    description: 'Quantities in display order.'
  })
})

export type ScalableListInput = (typeof ScalableListSchema)['Type']

export type ScalableListItem = (typeof ScalableListItemSchema)['Type']
