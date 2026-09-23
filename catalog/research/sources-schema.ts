import { Schema } from 'effect'

/**
 * Wire schema for the sources component: a numbered reference list. Each
 * entry carries a stable anchor so prose and the claims component can
 * cite it as <a href="#src-<id>">[n]</a>.
 */

export const SourceEntrySchema = Schema.Struct({
  title: Schema.String.annotate({
    description: 'Source title, e.g. R2 pricing: zero egress fees.'
  }),
  url: Schema.String.annotate({
    description: 'Source URL starting with http:// or https://; shown in full in mono.'
  }),
  publisher: Schema.String.annotate({ description: 'Who publishes it, e.g. Cloudflare.' }),
  published: Schema.optional(Schema.String).annotate({
    description: 'Publication date as written, e.g. 2026-08-01; omit when unknown.'
  }),
  observed: Schema.optional(Schema.String).annotate({
    description: 'Date the author last checked it, e.g. 2026-09-20.'
  }),
  supports: Schema.String.annotate({
    description: 'One line saying what this source supports in the page.'
  }),
  id: Schema.optional(Schema.String).annotate({
    description:
      'Stable anchor id with letters, digits, dashes and underscores, e.g. r2-pricing. The entry gains the anchor src-<id> so prose can cite it as <a href="#src-r2-pricing">[n]</a> and claims can list it in sources.'
  })
})

export const SourcesSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the list.'
  }),
  sources: Schema.Array(SourceEntrySchema).annotate({
    description: 'Sources in display order; numbers follow this order.'
  })
})

export type SourcesInput = (typeof SourcesSchema)['Type']

export type SourceEntry = (typeof SourceEntrySchema)['Type']
