import { Schema } from 'effect'

/**
 * Wire schema for the side-by-side component: two labelled panes holding
 * text or code. Code panes take a language and may mark changed lines.
 * Authors supply both sides; there is no diffing.
 */

export const SidePaneSchema = Schema.Struct({
  label: Schema.String.annotate({
    description: 'Pane heading, e.g. Before or After.'
  }),
  language: Schema.optional(Schema.String).annotate({
    description: 'Code language, e.g. ts. Shows line numbers; omit for prose.'
  }),
  text: Schema.String.annotate({
    description: 'Pane content: code when language is set, prose otherwise.'
  }),
  changedLines: Schema.optional(Schema.Array(Schema.Number)).annotate({
    description: '1-based lines to mark as changed. Author-supplied, not a diff.'
  })
})

export const SideBySideSchema = Schema.Struct({
  left: SidePaneSchema.annotate({
    description: 'Left pane on wide containers, top pane on narrow ones, e.g. Before.'
  }),
  right: SidePaneSchema.annotate({
    description: 'Right pane on wide containers, bottom pane on narrow ones, e.g. After.'
  })
})

export type SideBySideInput = (typeof SideBySideSchema)['Type']

export type SidePane = (typeof SidePaneSchema)['Type']
