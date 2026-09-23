import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate, Schema } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { calendarComponent } from '../catalog/plans/calendar.js'
import { CalendarSchema } from '../catalog/plans/calendar-schema.js'
import {
  civilFromDayNumber,
  dayNumber,
  parseIsoDate,
  renderCalendar
} from '../catalog/plans/calendar-render.js'
import { factSetComponent } from '../catalog/plans/fact-set.js'
import { quoteComponent } from '../catalog/plans/quote.js'
import { scalableListComponent } from '../catalog/plans/scalable-list.js'
import {
  formatScaled,
  roundScaled,
  renderScalableList
} from '../catalog/plans/scalable-list-render.js'
import { ScalableListSchema } from '../catalog/plans/scalable-list-schema.js'
import { statusListComponent } from '../catalog/plans/status-list.js'
import { formatSummary, renderStatusList } from '../catalog/plans/status-list-render.js'
import { StatusListSchema } from '../catalog/plans/status-list-schema.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function jsonFigure(name: string, json: string): string {
  return `<figure data-aha="${name}">\n<script type="application/json">${json}</script>\n</figure>`
}

function quoteBlock(markup: string): string {
  return `<div data-aha="quote">\n${markup}\n</div>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

const STATUS_JSON = `{
  "title": "Launch week",
  "groups": [
    { "name": "Blockers", "tasks": [
      { "title": "Freeze the schema", "status": "done", "owner": "Iris" },
      { "title": "Cut over the gateway", "status": "doing", "due": "2026-10-09", "note": "Waiting on DNS." },
      { "title": "Rotate the token", "status": "blocked", "owner": "Theo" }
    ] },
    { "name": "Later", "tasks": [{ "title": "Archive staging", "status": "todo" }] }
  ]
}`

const CALENDAR_JSON = `{
  "title": "October",
  "month": "2026-10",
  "today": "2026-10-08",
  "events": [
    { "title": "Freeze", "date": "2026-10-05", "kind": "deadline" },
    { "title": "Offsite", "start": "2026-10-07", "end": "2026-10-09", "note": "Cabin week." }
  ]
}`

const FACTS_JSON = `{
  "title": "Recorder",
  "groups": [
    { "name": "Audio", "items": [{ "key": "rate", "value": "48", "unit": "kHz" }] },
    { "name": "Power", "items": [{ "key": "runtime", "value": "11", "unit": "h" }] }
  ]
}`

const SCALE_JSON = `{
  "title": "Tortilla de patatas",
  "serves": 4,
  "presets": [2, 4, 8],
  "items": [
    { "name": "waxy potatoes", "qty": 800, "unit": "g" },
    { "name": "eggs", "qty": 6, "unit": "eggs" },
    { "name": "salt", "qty": null }
  ]
}`

const QUOTE_MARKUP = [
  '<p>Small pages win.</p>',
  '<p data-by="Jonas Reber" data-role="editor">Jonas Reber</p>'
].join('\n')

describe('plans components', () => {
  it.effect('status-list renders glyphs, words and a counts summary', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('status-list', STATUS_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('[x]')
      expect(html).toContain('[~]')
      expect(html).toContain('[!]')
      expect(html).toContain('[ ]')
      expect(html).toContain('doing')
      expect(html).toContain('1 of 4 done')
      expect(html).toContain('Waiting on DNS.')
      expect(html).toContain('due 2026-10-09')
    })
  )

  it.effect('status-list rejects an empty list', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(
        authorPage(jsonFigure('status-list', '{"title": "t"}'))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('status-list')
      }
    })
  )

  it.effect('status-list rejects an unknown state', () =>
    Effect.gen(function* () {
      const bad = '{"tasks": [{"title": "t", "status": "later"}]}'

      const failure = yield* buildPage(authorPage(jsonFigure('status-list', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toContain('status')
      }
    })
  )

  it.effect('calendar renders a month grid with marked today and an agenda', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('calendar', CALENDAR_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('cal-grid')
      expect(html).toContain('today')
      expect(html).toContain('Offsite')
      expect(html).toContain('Cabin week.')
      expect(html).toContain('cal-agenda')
      expect(html).toContain('7–9 October')
    })
  )

  it.effect('calendar renders a week strip for short ranges', () =>
    Effect.gen(function* () {
      const strip = `{"title": "Week", "start": "2026-10-05", "end": "2026-10-08", "events": [{"title": "Freeze", "date": "2026-10-06"}]}`

      const html = yield* buildPage(authorPage(jsonFigure('calendar', strip))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('cal-strip')
      expect(html).not.toContain('<table class="cal-grid"')
    })
  )

  it.effect('calendar rejects impossible dates', () =>
    Effect.gen(function* () {
      const bad = '{"month": "2026-10", "events": [{"title": "t", "date": "2026-02-30"}]}'

      const failure = yield* buildPage(authorPage(jsonFigure('calendar', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('calendar')
      }
    })
  )

  it.effect('fact-set renders keys, values and muted units', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('fact-set', FACTS_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('rate')
      expect(html).toContain('kHz')
      expect(html).toContain('Audio')
      expect(html).toContain('<dl class="facts">')
      expect(html).toContain('class="fill"')
    })
  )

  it.effect('fact-set rejects an empty sheet', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(authorPage(jsonFigure('fact-set', '{"title": "t"}'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('fact-set')
      }
    })
  )

  it.effect('scalable-list renders base quantities with data hooks', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('scalable-list', SCALE_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('800 g')
      expect(html).toContain('data-base="800"')
      expect(html).toContain('to taste')
      expect(html).toContain('data-set="8"')
      expect(html).toContain('/* bundle:scalable-list.client.js */')
    })
  )

  it.effect('scalable-list rejects unknown units and bad yields', () =>
    Effect.gen(function* () {
      const badUnit = '{"serves": 4, "items": [{"name": "x", "qty": 1, "unit": "cups"}]}'

      const unitFailure = yield* buildPage(authorPage(jsonFigure('scalable-list', badUnit))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(unitFailure, 'BlockDecodeError')).toBe(true)

      const badServes = '{"serves": 0, "items": [{"name": "x", "qty": 1}]}'

      const servesFailure = yield* buildPage(
        authorPage(jsonFigure('scalable-list', badServes))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(servesFailure, 'BlockDecodeError')).toBe(true)
    })
  )

  it.effect('quote renders prose with a generated caption', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(quoteBlock(QUOTE_MARKUP))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('Small pages win.')
      expect(html).toContain('Jonas Reber')
      expect(html).toContain('editor')
      expect(html).toContain('data-aha-generated="true"')
    })
  )

  it.effect('quote requires a credit paragraph', () =>
    Effect.gen(function* () {
      const failure = yield* buildPage(authorPage(quoteBlock('<p>No credit.</p>'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('quote')
        expect(failure.path).toBe('p[data-by]')
      }
    })
  )

  it.effect('rebuilds stay idempotent and inline only used bundles', () =>
    Effect.gen(function* () {
      const source = authorPage(
        [jsonFigure('status-list', STATUS_JSON), quoteBlock(QUOTE_MARKUP)].join('\n')
      )

      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).not.toContain('bundle:scalable-list.client.js')
    })
  )

  it('teaches every component through aha components output', () => {
    for (const name of ['status-list', 'calendar', 'fact-set', 'scalable-list', 'quote']) {
      const detail = formatComponentDetail(name, false)

      expect(detail).not.toBe(null)
    }

    const statusDetail = formatComponentDetail('status-list', false)

    if (statusDetail !== null) {
      expect(statusDetail).toContain('status')
      expect(statusDetail).toContain('<figure data-aha="status-list">')
    }

    const quoteDetail = formatComponentDetail('quote', false)

    if (quoteDetail !== null) {
      expect(quoteDetail).toContain('data-by')
    }

    expect(statusListComponent.examples.length).toBeGreaterThan(0)
    expect(calendarComponent.examples.length).toBe(2)
    expect(factSetComponent.examples.length).toBeGreaterThan(0)
    expect(scalableListComponent.clientBundle).toBe('scalable-list.client.js')
    expect(quoteComponent.examples.length).toBe(2)
  })

  it('scales quantities with per-unit rounding', () => {
    expect(roundScaled(400, 'g', false)).toBe(400)
    expect(roundScaled(402, 'g', false)).toBe(400)
    expect(roundScaled(3, 'eggs', false)).toBe(3)
    expect(roundScaled(0.4, 'eggs', false)).toBe(1)
    expect(roundScaled(0.75, 'tsp', false)).toBe(0.75)
    expect(roundScaled(1.33, 'pcs', false)).toBe(1.5)
    expect(roundScaled(0, 'g', false)).toBe(0)
    expect(formatScaled(2)).toBe('2')
    expect(formatScaled(0.5)).toBe('0.5')
    expect(formatScaled(2.5)).toBe('2.5')
  })

  it('counts statuses and formats the summary', () => {
    expect(formatSummary({ done: 1, doing: 1, blocked: 1, todo: 1 })).toBe(
      '1 of 4 done · 1 doing · 1 blocked · 1 todo'
    )
  })

  it('parses ISO days without timezone drift', () => {
    expect(parseIsoDate('2026-02-30')).toBe(null)
    expect(parseIsoDate('2026-13-01')).toBe(null)
    expect(parseIsoDate('not-a-date')).toBe(null)

    const civil = parseIsoDate('2026-10-05')

    expect(civil).not.toBe(null)

    if (civil !== null) {
      expect(civilFromDayNumber(dayNumber(civil))).toEqual(civil)
    }
  })

  it.effect('renders deterministically through the schemas', () =>
    Effect.gen(function* () {
      const statusDecoded = yield* Schema.decodeUnknownEffect(StatusListSchema)(
        JSON.parse(STATUS_JSON)
      )

      const left = renderStatusList(statusDecoded, { idPrefix: 'aha-0-status-list' })

      expect(renderStatusList(statusDecoded, { idPrefix: 'aha-0-status-list' })).toBe(left)

      const scaleDecoded = yield* Schema.decodeUnknownEffect(ScalableListSchema)(
        JSON.parse(SCALE_JSON)
      )

      const scaleLeft = renderScalableList(scaleDecoded, { idPrefix: 'aha-0-scalable-list' })

      expect(renderScalableList(scaleDecoded, { idPrefix: 'aha-0-scalable-list' })).toBe(scaleLeft)

      const calDecoded = yield* Schema.decodeUnknownEffect(CalendarSchema)(
        JSON.parse(CALENDAR_JSON)
      )

      const calLeft = renderCalendar(calDecoded, { idPrefix: 'aha-0-calendar' })

      expect(renderCalendar(calDecoded, { idPrefix: 'aha-0-calendar' })).toBe(calLeft)
    })
  )
})
