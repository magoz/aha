import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { levelScore, renderRiskMatrix } from './risk-matrix-render.js'
import { RiskMatrixSchema } from './risk-matrix-schema.js'
import { RISK_MATRIX_CSS } from './risk-matrix-css.js'

/**
 * risk-matrix component definition. Numbered markers on a small 5-by-5
 * grid plus a mitigation/owner list; hovering or focusing either side
 * highlights the other through one small client script.
 */

const MAX_RISKS = 12

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(RiskMatrixSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'risk-matrix',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.risks.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'risk-matrix',
            path: 'risks',
            detail: 'expected at least one risk'
          })
        )
      }

      if (decoded.risks.length > MAX_RISKS) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'risk-matrix',
            path: 'risks',
            detail: `expected at most ${String(MAX_RISKS)} risks`
          })
        )
      }

      for (let index = 0; index < decoded.risks.length; index += 1) {
        const risk = decoded.risks[index]

        if (risk !== undefined && risk.title.trim().length === 0) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'risk-matrix',
              path: `risks[${String(index)}].title`,
              detail: 'expected a non-empty risk name'
            })
          )
        }

        if (risk !== undefined && levelScore(risk.likelihood) === null) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'risk-matrix',
              path: `risks[${String(index)}].likelihood`,
              detail: 'expected 1 to 5, or low, med/medium, high'
            })
          )
        }

        if (risk !== undefined && levelScore(risk.impact) === null) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'risk-matrix',
              path: `risks[${String(index)}].impact`,
              detail: 'expected 1 to 5, or low, med/medium, high'
            })
          )
        }
      }

      return Effect.succeed(renderRiskMatrix(decoded, { idPrefix: request.idPrefix }))
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Nightly eval risks",
  "risks": [
    {
      "title": "The gateway hostname loops back to the box",
      "likelihood": 2,
      "impact": 5,
      "mitigation": "Forward only to the fixed public alias; refuse anything else.",
      "owner": "on-call"
    },
    {
      "title": "The box sleeps through the nightly run",
      "likelihood": "med",
      "impact": 4,
      "mitigation": "Wake timers plus a heartbeat alert on two misses.",
      "owner": "mar"
    },
    {
      "title": "The rerank model drifts week to week",
      "likelihood": 4,
      "impact": 2,
      "mitigation": "Pin the model digest and log it with every run."
    },
    {
      "title": "Eval artifacts fill the disk",
      "likelihood": "high",
      "impact": 3,
      "mitigation": "Retain seven nights, delete the rest.",
      "owner": "mar"
    }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'nightly-eval-risks',
    title: 'Nightly eval risks',
    caption: 'Four risks mixing numeric and word levels; hover a marker to find its row.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const riskMatrixComponent: CatalogComponent = {
  name: 'risk-matrix',
  category: 'research',
  summary: 'Risks plotted as numbered markers on a small grid, with mitigations and owners.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(RiskMatrixSchema),
  css: RISK_MATRIX_CSS,
  clientBundle: 'risk-matrix.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
