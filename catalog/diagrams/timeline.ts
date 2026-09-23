import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { parseDiagramDate } from './layout.js'
import { renderTimeline } from './timeline-render.js'
import { TimelineSchema } from './timeline-schema.js'
import { TIMELINE_CSS } from './timeline-css.js'

/**
 * timeline component definition. Phases and milestones on a date axis,
 * rendered as static SVG with an exact-dates fallback table.
 */

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(TimelineSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'timeline',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) => {
      if (decoded.phases.length === 0) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'timeline',
            path: 'phases',
            detail: 'expected at least one phase'
          })
        )
      }

      for (let index = 0; index < decoded.phases.length; index += 1) {
        const phase = decoded.phases[index]

        if (phase === undefined) {
          continue
        }

        const start = parseDiagramDate(phase.start)
        const end = parseDiagramDate(phase.end)

        if (start === null) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'timeline',
              path: `phases[${String(index)}].start`,
              detail: 'expected an ISO date or epoch millis'
            })
          )
        }

        if (end === null) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'timeline',
              path: `phases[${String(index)}].end`,
              detail: 'expected an ISO date or epoch millis'
            })
          )
        }

        if (end < start) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'timeline',
              path: `phases[${String(index)}].end`,
              detail: 'phase end is before its start'
            })
          )
        }
      }

      for (let index = 0; index < (decoded.milestones ?? []).length; index += 1) {
        const milestone = (decoded.milestones ?? [])[index]

        if (milestone !== undefined && parseDiagramDate(milestone.date) === null) {
          return Effect.fail(
            new BlockDecodeError({
              blockIndex: request.blockIndex,
              component: 'timeline',
              path: `milestones[${String(index)}].date`,
              detail: 'expected an ISO date or epoch millis'
            })
          )
        }
      }

      if (decoded.today !== undefined && parseDiagramDate(decoded.today) === null) {
        return Effect.fail(
          new BlockDecodeError({
            blockIndex: request.blockIndex,
            component: 'timeline',
            path: 'today',
            detail: 'expected an ISO date or epoch millis'
          })
        )
      }

      return Effect.succeed(
        renderTimeline(decoded, { width: request.width, idPrefix: request.idPrefix })
      )
    })
  )
}

const EXAMPLE_JSON = `{
  "title": "Harbor launch",
  "today": "2026-09-23",
  "phases": [
    { "label": "Discovery", "start": "2026-09-01", "end": "2026-09-12" },
    { "label": "Build", "start": "2026-09-13", "end": "2026-10-03", "highlight": true },
    { "label": "Harden", "start": "2026-10-04", "end": "2026-10-17" },
    { "label": "Launch", "start": "2026-10-18", "end": "2026-10-24" }
  ],
  "milestones": [
    { "label": "Spec frozen", "date": "2026-09-12" },
    { "label": "Beta cut", "date": "2026-10-03" },
    { "label": "Public", "date": "2026-10-24" }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'harbor-launch',
    title: 'Harbor launch',
    caption: 'Fig. 4. Four phases with a today marker; Build is the highlighted phase.',
    json: EXAMPLE_JSON,
    markup: null,
    markupKind: null
  }
]

export const timelineComponent: CatalogComponent = {
  name: 'timeline',
  category: 'diagrams',
  summary: 'Phases and milestones on a date axis with an optional today marker.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(TimelineSchema),
  css: TIMELINE_CSS,
  clientBundle: 'timeline.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
