import { Schema } from 'effect'

/**
 * Wire schema for the calendar component: a month grid, or a week strip
 * when start/end span ten days or less. Events carry one date or a
 * start/end range plus an optional kind and note.
 */

export const CalendarEventSchema = Schema.Struct({
  title: Schema.String.annotate({ description: 'Event title, e.g. schema freeze.' }),
  date: Schema.optional(Schema.String).annotate({
    description: 'Single-day event as an ISO date, e.g. 2026-10-08. Use date or start.'
  }),
  start: Schema.optional(Schema.String).annotate({
    description: 'First day of a multi-day event as an ISO date.'
  }),
  end: Schema.optional(Schema.String).annotate({
    description: 'Last day of a multi-day event as an ISO date; defaults to start.'
  }),
  kind: Schema.optional(Schema.String).annotate({
    description: 'Short kind label shown before the title, e.g. deadline or travel.'
  }),
  note: Schema.optional(Schema.String).annotate({
    description: 'Details shown on hover or focus, and in the agenda list.'
  })
})

export const CalendarSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the calendar.'
  }),
  month: Schema.optional(Schema.String).annotate({
    description:
      'Month grid to render as YYYY-MM, e.g. 2026-10. Defaults to the month of start or the first event.'
  }),
  start: Schema.optional(Schema.String).annotate({
    description: 'Range start as an ISO date. With end ten days out or less, renders a week strip.'
  }),
  end: Schema.optional(Schema.String).annotate({
    description: 'Range end as an ISO date.'
  }),
  today: Schema.optional(Schema.String).annotate({
    description: 'Day marked as today, as an ISO date.'
  }),
  weekStart: Schema.optional(Schema.Literals(['monday', 'sunday'])).annotate({
    description: 'First weekday column. Defaults to monday.'
  }),
  events: Schema.Array(CalendarEventSchema).annotate({
    description: 'Events in display order; multi-day events span every covered cell.'
  })
})

export type CalendarInput = (typeof CalendarSchema)['Type']

export type CalendarEvent = (typeof CalendarEventSchema)['Type']
