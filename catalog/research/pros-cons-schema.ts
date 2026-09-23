import { Schema } from 'effect'

/**
 * Wire schema for the pros-cons component: two weighted lists with an
 * optional verdict line.
 */

export const ProConItemSchema = Schema.Struct({
  text: Schema.String.annotate({ description: 'One pro or con, in one line.' }),
  weight: Schema.optional(Schema.String).annotate({
    description:
      'Short weight marker shown in mono, e.g. +2 or high; keep it to a few characters, never a bar.'
  })
})

export const ProsConsSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the columns.'
  }),
  pros: Schema.Array(ProConItemSchema).annotate({
    description: 'The case for, in display order.'
  }),
  cons: Schema.Array(ProConItemSchema).annotate({
    description: 'The case against, in display order.'
  }),
  verdict: Schema.optional(Schema.String).annotate({
    description: 'One-line verdict shown below the columns.'
  })
})

export type ProsConsInput = (typeof ProsConsSchema)['Type']
