import { Effect, Schema } from 'effect'

import type { CatalogComponent, ComponentExample, JsonRenderRequest } from '../component.js'
import { describeSchemaFields } from '../fields.js'
import { BlockDecodeError } from '../errors.js'
import { firstIssuePath, formatIssueDetail } from '../decode.js'
import { dayNumber, parseIsoDate, renderCalendar } from './calendar-render.js'
import { CalendarSchema } from './calendar-schema.js'
import { CALENDAR_CSS } from './calendar-css.js'

/**
 * calendar component definition. A month grid, or a week strip when the
 * requested range spans ten days or less. Dates are validated as real
 * ISO days; multi-day ranges stay bounded.
 */

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

function fail(
  request: JsonRenderRequest,
  path: string,
  detail: string
): Effect.Effect<never, BlockDecodeError> {
  return Effect.fail(
    new BlockDecodeError({ blockIndex: request.blockIndex, component: 'calendar', path, detail })
  )
}

function checkIso(
  request: JsonRenderRequest,
  path: string,
  raw: string
): Effect.Effect<void, BlockDecodeError> {
  if (parseIsoDate(raw) === null) {
    return fail(request, path, `expected a real ISO date YYYY-MM-DD, got ${raw}`)
  }

  return Effect.void
}

function decodeRequest(request: JsonRenderRequest): Effect.Effect<string, BlockDecodeError> {
  return Schema.decodeUnknownEffect(CalendarSchema)(request.json).pipe(
    Effect.mapError(
      (parseError) =>
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'calendar',
          path: firstIssuePath(parseError.issue),
          detail: formatIssueDetail(parseError.issue)
        })
    ),
    Effect.flatMap((decoded) =>
      Effect.gen(function* () {
        if (decoded.events.length === 0) {
          return yield* fail(request, 'events', 'expected at least one event')
        }

        if (decoded.month !== undefined && MONTH_PATTERN.exec(decoded.month) === null) {
          return yield* fail(request, 'month', `expected YYYY-MM, got ${decoded.month}`)
        }

        if (decoded.start !== undefined) {
          yield* checkIso(request, 'start', decoded.start)
        }

        if (decoded.end !== undefined) {
          yield* checkIso(request, 'end', decoded.end)
        }

        if (decoded.today !== undefined) {
          yield* checkIso(request, 'today', decoded.today)
        }

        if (
          decoded.start !== undefined &&
          decoded.end !== undefined &&
          decoded.month === undefined
        ) {
          const first = parseIsoDate(decoded.start)
          const last = parseIsoDate(decoded.end)

          if (first !== null && last !== null) {
            const span = dayNumber(last) - dayNumber(first)

            if (span < 0) {
              return yield* fail(request, 'end', 'expected end on or after start')
            }

            if (span > 62) {
              return yield* fail(request, 'end', 'expected the range to span 62 days or less')
            }
          }
        }

        for (let index = 0; index < decoded.events.length; index += 1) {
          const event = decoded.events[index]

          if (event === undefined) {
            continue
          }

          const here = `events[${String(index)}]`

          if (event.date !== undefined) {
            yield* checkIso(request, `${here}.date`, event.date)
          }

          if (event.start !== undefined) {
            yield* checkIso(request, `${here}.start`, event.start)
          }

          if (event.end !== undefined) {
            yield* checkIso(request, `${here}.end`, event.end)
          }

          if (event.date === undefined && event.start === undefined) {
            return yield* fail(request, here, 'expected date or start for the event')
          }

          if (event.date !== undefined && event.start !== undefined) {
            return yield* fail(request, here, 'expected date or start, not both')
          }

          if (event.end !== undefined && event.start === undefined) {
            return yield* fail(request, `${here}.end`, 'expected start alongside end')
          }

          if (event.start !== undefined && event.end !== undefined) {
            const first = parseIsoDate(event.start)
            const last = parseIsoDate(event.end)

            if (first !== null && last !== null && dayNumber(last) < dayNumber(first)) {
              return yield* fail(request, `${here}.end`, 'expected end on or after start')
            }
          }
        }

        const monthFromEvents = (() => {
          for (const event of decoded.events) {
            const raw = event.date ?? event.start

            if (raw !== undefined) {
              return raw.slice(0, 7)
            }
          }

          return null
        })()

        const resolved = {
          ...decoded,
          month: decoded.month ?? (decoded.start ?? monthFromEvents ?? '2026-01').slice(0, 7)
        }

        return renderCalendar(resolved, { idPrefix: request.idPrefix })
      })
    )
  )
}

const EXAMPLE_MONTH_JSON = `{
  "title": "October launch month",
  "month": "2026-10",
  "today": "2026-10-08",
  "events": [
    { "title": "Schema freeze", "date": "2026-10-05", "kind": "deadline", "note": "No field renames after this date." },
    { "title": "Team offsite", "start": "2026-10-07", "end": "2026-10-09", "kind": "travel", "note": "Cabin, two talks, one hike." },
    { "title": "Gateway cutover", "date": "2026-10-12", "kind": "deadline" },
    { "title": "Dentist", "date": "2026-10-15", "note": "Morning appointment, back by lunch." },
    { "title": "Launch review", "date": "2026-10-21", "kind": "meeting" },
    { "title": "Public write-up", "start": "2026-10-26", "end": "2026-10-28", "note": "Draft, revise, hand to the editor." }
  ]
}`

const EXAMPLE_STRIP_JSON = `{
  "title": "Release week",
  "start": "2026-10-05",
  "end": "2026-10-10",
  "today": "2026-10-08",
  "events": [
    { "title": "Schema freeze", "date": "2026-10-05", "kind": "deadline" },
    { "title": "Team offsite", "start": "2026-10-07", "end": "2026-10-09", "kind": "travel" },
    { "title": "Gateway cutover", "date": "2026-10-08", "kind": "deadline", "note": "Point the gateway at the fixed upstream." }
  ]
}`

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'launch-month',
    title: 'October launch month',
    caption: 'A month grid with a multi-day offsite; today is marked.',
    json: EXAMPLE_MONTH_JSON,
    markup: null,
    markupKind: null
  },
  {
    id: 'release-week',
    title: 'Release week',
    caption: 'A six-day range renders as a week strip instead of a grid.',
    json: EXAMPLE_STRIP_JSON,
    markup: null,
    markupKind: null
  }
]

export const calendarComponent: CatalogComponent = {
  name: 'calendar',
  category: 'plans',
  summary: 'A month grid, or a week strip for ranges of ten days or less.',
  inputKind: 'json',
  markupTag: null,
  fields: describeSchemaFields(CalendarSchema),
  css: CALENDAR_CSS,
  clientBundle: 'calendar.client.js',
  examples: EXAMPLES,
  renderJson: decodeRequest,
  renderMarkup: null
}
