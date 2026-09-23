import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { renderDecisionRecord } from './decision-record-render.js'
import { DecisionRecordSchema } from './decision-record-schema.js'
import { DECISION_RECORD_CSS } from './decision-record-css.js'

/**
 * decision-record component definition. One ADR per block; the decision
 * must name one of the listed options or the build fails at that path.
 */

const MAX_OPTIONS = 12

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(DecisionRecordSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'decision-record',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.title.trim().length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'decision-record',
            path: 'title',
            detail: 'expected a non-empty title'
          })
        )
      }

      if (decoded.context.trim().length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'decision-record',
            path: 'context',
            detail: 'expected a non-empty context'
          })
        )
      }

      if (decoded.options.length < 2) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'decision-record',
            path: 'options',
            detail: 'expected at least two options'
          })
        )
      }

      if (decoded.options.length > MAX_OPTIONS) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'decision-record',
            path: 'options',
            detail: `expected at most ${String(MAX_OPTIONS)} options`
          })
        )
      }

      for (let index = 0; index < decoded.options.length; index += 1) {
        const option = decoded.options[index]

        if (option !== undefined && option.name.trim().length === 0) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'decision-record',
              path: `options[${String(index)}].name`,
              detail: 'expected a non-empty option name'
            })
          )
        }

        if (option !== undefined && option.summary.trim().length === 0) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'decision-record',
              path: `options[${String(index)}].summary`,
              detail: 'expected a one-line option summary'
            })
          )
        }
      }

      let chosen = false

      for (const option of decoded.options) {
        if (option.name === decoded.decision.option) {
          chosen = true
          break
        }
      }

      if (!chosen) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'decision-record',
            path: 'decision.option',
            detail: `unknown option "${decoded.decision.option}": use one options[].name`
          })
        )
      }

      if (decoded.decision.why.trim().length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'decision-record',
            path: 'decision.why',
            detail: 'expected why this option won'
          })
        )
      }

      return Effect.succeed(renderDecisionRecord(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Where to run the nightly eval",
  "status": "accepted",
  "date": "2026-09-20",
  "context": "The eval needs rerank compute, must wake itself, and must read private documents over the tailnet. The laptop sleeps mid-run and Vercel cron cannot read the tailnet.",
  "options": [
    { "name": "laptop", "summary": "Free and local, but sleeps mid-run and takes 42 minutes wall time." },
    { "name": "tailnet box", "summary": "Always on, reads private documents, 11 minutes a run for about four cents." },
    { "name": "vercel cron", "summary": "Fastest at 9 minutes but no private reads and the timeout may clip long runs." }
  ],
  "decision": {
    "option": "tailnet box",
    "why": "It is the only option that reads private documents and finishes inside the nightly window."
  },
  "consequences": {
    "positive": ["Private reads work without weakening the gateway."],
    "negative": ["Someone owns wake timers and disk space on the box."]
  }
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'nightly-eval-home',
    title: 'Where to run the nightly eval',
    caption: 'An accepted ADR: three options, the tailnet box chosen, signed consequences.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const decisionRecordComponent: CatalogComponent = {
  name: 'decision-record',
  category: 'research',
  summary: 'One architecture decision record: context, options, the chosen option, consequences.',
  inputKind: 'json',
  fields: describeSchemaFields(DecisionRecordSchema),
  css: DECISION_RECORD_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
