import { Schema } from 'effect'

/**
 * Wire schema for the file-tree component: a flat list of paths with
 * optional change statuses and notes, rendered as a grouped tree.
 */

export const FileTreeStatusSchema = Schema.Literals(['added', 'changed', 'removed', 'renamed'])

export const FileTreeEntrySchema = Schema.Struct({
  path: Schema.String.annotate({
    description: 'File or folder path, e.g. gateway/policy.ts. Folders group automatically.'
  }),
  status: Schema.optional(FileTreeStatusSchema).annotate({
    description: 'Change status: added, changed, removed or renamed. Shown as a glyph plus a word.'
  }),
  previous: Schema.optional(Schema.String).annotate({
    description: 'Old path, only with status renamed; shown as old path leading to new.'
  }),
  note: Schema.optional(Schema.String).annotate({
    description: 'Short note in the muted column, e.g. folded into forward.ts.'
  })
})

export const FileTreeSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the tree.'
  }),
  entries: Schema.Array(FileTreeEntrySchema).annotate({
    description: 'Flat path list in display order; folders group automatically.'
  })
})

export type FileTreeInput = (typeof FileTreeSchema)['Type']

export type FileTreeEntry = (typeof FileTreeEntrySchema)['Type']
