import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { StatusListGroup, StatusListInput, StatusListTask } from './status-list-schema.js'

/**
 * Status-list renderer. Tasks with a mono glyph plus a status word (never
 * colour alone), an optional owner and due date, and a summary line with
 * counts. Pure builders, no DOM.
 */

export interface StatusListRenderOptions {
  readonly idPrefix: string
}

export interface StatusCounts {
  readonly done: number
  readonly doing: number
  readonly blocked: number
  readonly todo: number
}

function glyphFor(status: string): string {
  if (status === 'done') {
    return '[x]'
  }

  if (status === 'doing') {
    return '[~]'
  }

  if (status === 'blocked') {
    return '[!]'
  }

  return '[ ]'
}

function statusClass(status: string): string {
  if (status === 'done' || status === 'doing' || status === 'blocked' || status === 'todo') {
    return `st-${status}`
  }

  return 'st-todo'
}

function statusWord(status: string): string {
  if (status === 'done' || status === 'doing' || status === 'blocked' || status === 'todo') {
    return status
  }

  return 'todo'
}

export function countStatuses(
  tasks: ReadonlyArray<StatusListTask>,
  groups: ReadonlyArray<StatusListGroup>
): StatusCounts {
  let done = 0
  let doing = 0
  let blocked = 0
  let todo = 0

  const tally = (task: StatusListTask): void => {
    if (task.status === 'done') {
      done += 1
    } else if (task.status === 'doing') {
      doing += 1
    } else if (task.status === 'blocked') {
      blocked += 1
    } else {
      todo += 1
    }
  }

  for (const task of tasks) {
    tally(task)
  }

  for (const group of groups) {
    for (const task of group.tasks) {
      tally(task)
    }
  }

  return { done, doing, blocked, todo }
}

export function formatSummary(counts: StatusCounts): string {
  const total = counts.done + counts.doing + counts.blocked + counts.todo

  return `${String(counts.done)} of ${String(total)} done · ${String(counts.doing)} doing · ${String(counts.blocked)} blocked · ${String(counts.todo)} todo`
}

function renderTask(task: StatusListTask): string {
  const metaParts: Array<string> = []

  if (task.owner !== undefined) {
    metaParts.push(escapeHtml(task.owner))
  }

  if (task.due !== undefined) {
    metaParts.push(`due ${escapeHtml(task.due)}`)
  }

  const meta = metaParts.length === 0 ? '' : `<span class="meta">${metaParts.join(' · ')}</span>`
  const note = task.note === undefined ? '' : `<span class="note">${escapeHtml(task.note)}</span>`

  return `<li class="${statusClass(task.status)}"><span class="glyph" aria-hidden="true">${glyphFor(task.status)}</span><span class="body"><span class="t">${escapeHtml(task.title)}</span> <span class="st-word">${statusWord(task.status)}</span>${meta}${note}</span></li>`
}

function renderTaskList(tasks: ReadonlyArray<StatusListTask>): string {
  let items = ''

  for (const task of tasks) {
    items += renderTask(task)
  }

  return `<ul class="st-tasks">${items}</ul>`
}

export function renderStatusList(input: StatusListInput, options: StatusListRenderOptions): string {
  const tasks = input.tasks ?? []
  const groups = input.groups ?? []
  const counts = countStatuses(tasks, groups)

  let body = `<p class="sum">${escapeHtml(formatSummary(counts))}</p>`

  if (tasks.length > 0) {
    body += renderTaskList(tasks)
  }

  for (const group of groups) {
    const groupCounts = countStatuses(group.tasks, [])
    const total = group.tasks.length

    body += `<section class="st-group"><h3 class="g-name">${escapeHtml(group.name)} <span class="g-count">${String(groupCounts.done)} of ${String(total)} done</span></h3>${renderTaskList(group.tasks)}</section>`
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-status" data-status="status-list" data-status-id="${escapeAttr(options.idPrefix)}">${title}${body}</div>`
}
