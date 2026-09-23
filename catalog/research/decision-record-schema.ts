import { Schema } from 'effect'

/**
 * Wire schema for the decision-record component: one ADR per block with
 * its options, the chosen option, and positive/negative consequences.
 */

export const DecisionOptionSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Option name, e.g. tailnet box.' }),
  summary: Schema.String.annotate({ description: 'What this option means, in one line.' })
})

export const DecisionChoiceSchema = Schema.Struct({
  option: Schema.String.annotate({
    description:
      'Name of the chosen option; must match one options[].name exactly. The chosen option renders with the accent.'
  }),
  why: Schema.String.annotate({ description: 'Why this option won, in one or two sentences.' })
})

export const ConsequencesSchema = Schema.Struct({
  positive: Schema.Array(Schema.String).annotate({
    description: 'Good outcomes of the decision, one line each.'
  }),
  negative: Schema.Array(Schema.String).annotate({
    description: 'Costs and risks accepted with the decision, one line each.'
  })
})

export const DecisionRecordSchema = Schema.Struct({
  title: Schema.String.annotate({
    description: 'Decision title, e.g. Where to run the nightly eval.'
  }),
  status: Schema.Literals(['proposed', 'accepted', 'superseded']).annotate({
    description:
      'Record status: proposed, accepted or superseded. Shown as a text badge plus a glyph.'
  }),
  date: Schema.optional(Schema.String).annotate({
    description: 'Decision date as written, e.g. 2026-09-20.'
  }),
  context: Schema.String.annotate({
    description: 'The situation forcing the decision, in a few sentences.'
  }),
  options: Schema.Array(DecisionOptionSchema).annotate({
    description: 'The considered options with one-line summaries, in display order.'
  }),
  decision: DecisionChoiceSchema.annotate({
    description: 'The chosen option by name, plus why it won.'
  }),
  consequences: ConsequencesSchema.annotate({
    description: 'Positive and negative consequence lists.'
  })
})

export type DecisionRecordInput = (typeof DecisionRecordSchema)['Type']

export type DecisionOption = (typeof DecisionOptionSchema)['Type']
