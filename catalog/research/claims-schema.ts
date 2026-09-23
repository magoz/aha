import { Schema } from 'effect'

/**
 * Wire schema for the claims component: findings with a confidence level
 * and optional citations into the sources list on the same page.
 */

export const ClaimSchema = Schema.Struct({
  statement: Schema.String.annotate({ description: 'The finding in one or two sentences.' }),
  confidence: Schema.Literals(['high', 'medium', 'low']).annotate({
    description:
      'Confidence in the finding: high, medium or low. Shown as a text badge plus a glyph, never colour alone.'
  }),
  sources: Schema.optional(Schema.Array(Schema.String)).annotate({
    description:
      'Source ids cited by this finding, in display order, e.g. ["r2-pricing"]. Each renders as an [n] link to the #src-<id> anchor in the sources block. Numbers follow first-mention order across this block, so list the sources block in the same order to keep the numbers matching.'
  })
})

export const ClaimsSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the findings.'
  }),
  claims: Schema.Array(ClaimSchema).annotate({
    description: 'Findings in display order.'
  })
})

export type ClaimsInput = (typeof ClaimsSchema)['Type']

export type Claim = (typeof ClaimSchema)['Type']
