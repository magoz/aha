import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr, escapeHtml } from '../shared/svg.js'

/**
 * steps component definition. A numbered procedure over li children: each
 * step has a title, an optional duration in seconds and an optional
 * `data-ready` cue paragraph. Without scripts it is a plain ordered list;
 * the client adds one-at-a-time countdown timers and a movable current
 * step highlight.
 */

export const STEPS_CSS = `
.aha-steps { max-width: 40rem; margin: 0 0 var(--unit); padding-left: 0; list-style: none; counter-reset: aha-step; }
.aha-steps > li { counter-increment: aha-step; border: 1px solid var(--rule); border-top: 0; padding: 0.75rem 1rem 1rem; margin: 0; }
.aha-steps > li:first-child { border-top: 1px solid var(--rule); }
.aha-steps > li.current { border-left: 2px solid var(--accent); }
.aha-steps > li.done { border-left: 2px solid var(--accent); }
.aha-steps .step-h { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; align-items: baseline; margin-bottom: 0.5rem; cursor: pointer; }
.aha-steps .step-h::before { content: counter(aha-step, decimal-leading-zero); font-family: var(--mono); font-size: var(--t-sm); color: var(--muted); }
.aha-steps .step-h .t { font-family: var(--mono); font-weight: 600; font-size: var(--t-sm); flex: 1 1 12rem; }
.aha-steps .step-h .dur { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); white-space: nowrap; }
.aha-steps .step-h .done-mark { font-family: var(--mono); font-size: var(--t-xs); color: var(--accent); white-space: nowrap; }
.aha-steps [data-ready]::before { content: "Ready when: "; font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.aha-steps .step-nav { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; }
.aha-steps .step-nav button, .aha-steps .timer button { font-family: var(--mono); font-size: var(--t-xs); padding: 0.375rem 0.75rem; border: 1px solid var(--rule); background: none; color: var(--ink); cursor: pointer; }
.aha-steps .step-nav button:hover, .aha-steps .timer button:hover { border-color: var(--accent); color: var(--accent); }
.aha-steps .step-nav .pos { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); }
.aha-steps .timer { display: flex; gap: 0.75rem; align-items: baseline; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--hair); }
.aha-steps .timer .left { font-family: var(--mono); font-size: var(--t-sm); font-variant-numeric: tabular-nums; }
@media print {
  .aha-steps .step-nav, .aha-steps .timer button { display: none; }
}
`

const STEPS_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'children',
    type: 'markup',
    description: 'One li per step with a data-step title and optional data-duration seconds.',
    required: true
  },
  {
    path: 'data-ready',
    type: 'markup',
    description: 'A paragraph with data-ready inside a step states its ready-when cue.',
    required: false
  }
]

export interface StepItem {
  readonly title: string
  readonly durationSec: number | null
  readonly inner: string
}

function readLiAttribute(openTag: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*"([^"]*)"`)
  const match = pattern.exec(openTag)

  if (match === null) {
    return null
  }

  const value = match[1]

  if (value === undefined) {
    return null
  }

  return value
}

function findTagEnd(html: string, from: number): number {
  let cursor = from
  let quoted: string | null = null

  while (cursor < html.length) {
    const char = html[cursor]

    if (char === undefined) {
      return -1
    }

    if (quoted !== null) {
      if (char === quoted) {
        quoted = null
      }

      cursor += 1
      continue
    }

    if (char === '"' || char === "'") {
      quoted = char
      cursor += 1
      continue
    }

    if (char === '>') {
      return cursor
    }

    cursor += 1
  }

  return -1
}

function tagNameAt(
  html: string,
  at: number
): { readonly name: string; readonly closing: boolean } | null {
  let cursor = at + 1
  let closing = false

  if (html[cursor] === '/') {
    closing = true
    cursor += 1
  }

  let name = ''

  while (cursor < html.length) {
    const char = html[cursor]

    if (char === undefined || char === ' ' || char === '\\t' || char === '\\n' || char === '>') {
      break
    }

    name += char
    cursor += 1
  }

  if (name === 'li' || name === 'ul' || name === 'ol') {
    return { name, closing }
  }

  return null
}

function parseDuration(raw: string | null): number | null {
  if (raw === null || raw.length === 0) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/** Split top-level li items, tracking nested lists so a task list inside
 * a step does not end the item early. */
export function splitStepItems(innerHtml: string): ReadonlyArray<StepItem> {
  const out: Array<StepItem> = []
  let cursor = 0
  let depth = 0
  let itemStart = -1
  let itemOpen = ''
  let itemInnerStart = 0

  while (cursor < innerHtml.length) {
    const at = innerHtml.indexOf('<', cursor)

    if (at === -1) {
      break
    }

    const tag = tagNameAt(innerHtml, at)

    if (tag === null) {
      cursor = at + 1
      continue
    }

    if (!tag.closing) {
      const end = findTagEnd(innerHtml, at)

      if (end === -1) {
        break
      }

      if (tag.name === 'li' && depth === 0) {
        itemStart = at
        itemOpen = innerHtml.slice(at, end + 1)
        itemInnerStart = end + 1
      }

      depth += 1
      cursor = end + 1
      continue
    }

    const end = innerHtml.indexOf('>', at)

    if (end === -1) {
      break
    }

    if (depth > 0) {
      depth -= 1
    }

    if (tag.name === 'li' && depth === 0 && itemStart !== -1) {
      const openTag = itemOpen
      const title = readLiAttribute(openTag, 'data-step') ?? ''
      const durationSec = parseDuration(readLiAttribute(openTag, 'data-duration'))
      out.push({
        title,
        durationSec,
        inner: innerHtml.slice(itemInnerStart, at)
      })
      itemStart = -1
      itemOpen = ''
    }

    cursor = end + 1
  }

  return out
}

export function formatDuration(totalSec: number): string {
  if (totalSec < 60) {
    return `${String(totalSec)} s`
  }

  if (totalSec < 3600) {
    const minutes = Math.round(totalSec / 60)

    return `${String(minutes)} min`
  }

  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.round((totalSec - hours * 3600) / 60)

  if (minutes === 0) {
    return `${String(hours)} h`
  }

  return `${String(hours)} h ${String(minutes)} min`
}

function stripGeneratedHeaders(innerHtml: string): string {
  return innerHtml.replace(/<div class="step-h" data-aha-generated="true">.*?<\/div>/gs, '')
}

function renderSteps(request: MarkupRenderRequest): Effect.Effect<string, BlockDecodeError> {
  const clean = stripGeneratedHeaders(request.innerHtml)
  const items = splitStepItems(clean)

  if (items.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'steps',
        path: 'children',
        detail: 'expected at least one <li data-step="Title"> child'
      })
    )
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]

    if (item !== undefined && item.title.length === 0) {
      return Effect.fail(
        new BlockDecodeError({
          blockIndex: request.blockIndex,
          component: 'steps',
          path: `children[${String(index)}]`,
          detail: 'each step li needs a data-step title'
        })
      )
    }
  }

  let body = ''

  for (const item of items) {
    const dur =
      item.durationSec === null
        ? ''
        : `<span class="dur">${escapeHtml(formatDuration(item.durationSec))}</span>`

    body += `<li data-step="${escapeAttr(item.title)}"${item.durationSec === null ? '' : ` data-duration="${String(item.durationSec)}"`}><div class="step-h" data-aha-generated="true"><span class="t">${escapeHtml(item.title)}</span>${dur}</div>${item.inner}</li>`
  }

  let widthAttr = ''

  for (const attr of request.attributes) {
    if (attr.name === 'data-width') {
      const parsed = Number.parseInt(attr.value, 10)

      if (Number.isSafeInteger(parsed)) {
        const clamped = Math.min(1200, Math.max(280, parsed))
        widthAttr = ` data-width="${String(clamped)}"`
      }
    }
  }

  return Effect.succeed(
    `<ol data-aha="steps" class="aha-steps" data-steps-id="${escapeAttr(request.idPrefix)}"${widthAttr}>${body}</ol>`
  )
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'morning-deploy',
    title: 'Morning deploy runbook',
    caption: 'Four steps with durations and ready-when cues; timers need scripts.',
    json: null,
    markup: [
      '<li data-step="Brew and review" data-duration="300">',
      '<p>Pour the coffee, open the deploy checklist, read the diff stat once through.</p>',
      '<p data-ready>The diff stat fits on one screen and nothing touches migrations.</p>',
      '</li>',
      '<li data-step="Run the suite" data-duration="900">',
      '<p>Run the full verify on a clean checkout while the coffee cools.</p>',
      '<p data-ready>Format, typecheck, lint and tests all pass with no skips.</p>',
      '</li>',
      '<li data-step="Ship behind the flag">',
      '<p>Merge, deploy with the flag off, then enable for staff only and watch the error rate.</p>',
      '<p data-ready>Staff traffic runs clean for fifteen minutes.</p>',
      '</li>',
      '<li data-step="Roll out and note it" data-duration="600">',
      '<p>Enable for everyone, then write the one-line changelog entry while the graphs settle.</p>',
      '<p data-ready>The changelog entry names the flag and the rollback step.</p>',
      '</li>'
    ].join('\n'),
    markupKind: null
  }
]

export const stepsComponent: CatalogComponent = {
  name: 'steps',
  category: 'interactive',
  summary: 'Numbered procedure with timed steps, ready cues and a current-step highlight.',
  inputKind: 'markup',
  fields: STEPS_FIELDS,
  css: STEPS_CSS,
  clientBundle: 'steps.client.js',
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderSteps
}
