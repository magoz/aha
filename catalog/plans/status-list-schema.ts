import { Schema } from 'effect'

/**
 * Wire schema for the status-list component: tasks with a four-state
 * status, optional owner, due date and note, shown flat or grouped.
 */

export const StatusListTaskSchema = Schema.Struct({
  title: Schema.String.annotate({ description: 'Task title, e.g. freeze the eval schema.' }),
  status: Schema.Literals(['done', 'doing', 'blocked', 'todo']).annotate({
    description: 'Task state: done, doing, blocked or todo. Shown as a mono glyph plus the word.'
  }),
  owner: Schema.optional(Schema.String).annotate({
    description: 'Owner name or handle shown after the title.'
  }),
  due: Schema.optional(Schema.String).annotate({
    description: 'Due date as an ISO date, e.g. 2026-10-09.'
  }),
  note: Schema.optional(Schema.String).annotate({
    description: 'One-line note, e.g. what the task waits on.'
  })
})

export const StatusListGroupSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Group name, e.g. ship blockers.' }),
  tasks: Schema.Array(StatusListTaskSchema).annotate({
    description: 'Tasks in this group, in display order.'
  })
})

export const StatusListSchema = Schema.Struct({
  title: Schema.optional(Schema.String).annotate({
    description: 'Short title shown above the list.'
  }),
  tasks: Schema.optional(Schema.Array(StatusListTaskSchema)).annotate({
    description: 'Ungrouped tasks in display order. Use tasks, groups, or both.'
  }),
  groups: Schema.optional(Schema.Array(StatusListGroupSchema)).annotate({
    description: 'Named task groups in display order. Use tasks, groups, or both.'
  })
})

export type StatusListInput = (typeof StatusListSchema)['Type']

export type StatusListTask = (typeof StatusListTaskSchema)['Type']

export type StatusListGroup = (typeof StatusListGroupSchema)['Type']
