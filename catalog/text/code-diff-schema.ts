import { Schema } from 'effect'

/**
 * Wire schema for the code-diff component: a unified diff with a file
 * header, rendered with line numbers and a marker column.
 */

export const CodeDiffSchema = Schema.Struct({
  file: Schema.optional(Schema.String).annotate({
    description: 'File path shown in the diff header, e.g. gateway/policy.ts.'
  }),
  diff: Schema.String.annotate({
    description: 'Unified diff text: @@ hunks with space, + and - lines.'
  })
})

export type CodeDiffInput = (typeof CodeDiffSchema)['Type']
