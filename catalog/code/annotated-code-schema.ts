import { Schema } from 'effect'

/**
 * Wire schema for the annotated-code component: a code block with a
 * language label and optional filename, where numbered notes reference
 * 1-based code lines.
 */

export const AnnotatedCodeNoteSchema = Schema.Struct({
  lines: Schema.Array(Schema.Number).annotate({
    description: '1-based code lines this note explains, e.g. [3, 4].'
  }),
  title: Schema.String.annotate({
    description: 'Short note heading, e.g. Capped backoff.'
  }),
  text: Schema.String.annotate({
    description: 'One or two sentences explaining the marked lines.'
  })
})

export const AnnotatedCodeSchema = Schema.Struct({
  language: Schema.optional(Schema.String).annotate({
    description: 'Language label shown beside the filename, e.g. ts.'
  }),
  filename: Schema.optional(Schema.String).annotate({
    description: 'File path shown above the code, e.g. gateway/retry.ts.'
  }),
  code: Schema.String.annotate({
    description: 'Code text; lines are numbered from 1.'
  }),
  notes: Schema.Array(AnnotatedCodeNoteSchema).annotate({
    description: 'Numbered notes in display order; each lists the lines it explains.'
  })
})

export type AnnotatedCodeInput = (typeof AnnotatedCodeSchema)['Type']

export type AnnotatedCodeNote = (typeof AnnotatedCodeNoteSchema)['Type']
