import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr, escapeHtml } from '../shared/svg.js'

/**
 * checklist component definition. Items with optional group rows: without
 * scripts the boxes still toggle natively; the client keeps a live
 * progress count. State stays in memory only, never in storage.
 */

export const CHECKLIST_CSS = `
.aha-checklist { list-style: none; margin: 0 0 var(--unit); padding: 0; border: 1px solid var(--rule); max-width: 40rem; }
.aha-checklist > li { display: flex; gap: 0.75rem; align-items: baseline; margin: 0; padding: 0.5rem 1rem; border-bottom: 1px solid var(--hair); }
.aha-checklist > li:last-child { border-bottom: 0; }
.aha-checklist > li.ck-group { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); background: none; padding-top: 0.75rem; }
.aha-checklist > li.ck-progress { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); border-bottom: 1px solid var(--rule); }
.aha-checklist > li.item:has(> .ck:checked) { color: var(--muted); }
.aha-checklist .ck { width: 1rem; height: 1rem; flex: none; accent-color: var(--accent); margin: 0; transform: translateY(0.125rem); }
.aha-checklist .txt { flex: 1; min-width: 0; }
`

const CHECKLIST_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'children',
    type: 'markup',
    description: 'One li per item; an empty li with data-group="Label" starts a group.',
    required: true
  }
]

interface CheckItem {
  readonly group: string | null
  readonly openTag: string
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

/** Split top-level li rows, tracking nested lists so an item holding a
 * sub-list stays one item. */
export function splitCheckItems(innerHtml: string): ReadonlyArray<CheckItem> {
  const out: Array<CheckItem> = []
  let cursor = 0
  let depth = 0
  let openTag = ''
  let innerStart = 0

  while (cursor < innerHtml.length) {
    const openAt = innerHtml.indexOf('<li', cursor)
    const closeAt = innerHtml.indexOf('</li>', cursor)
    const listAt = innerHtml.indexOf('<ul', cursor)
    const listCloseAt = innerHtml.indexOf('</ul>', cursor)
    const orderedAt = innerHtml.indexOf('<ol', cursor)
    const orderedCloseAt = innerHtml.indexOf('</ol>', cursor)

    let next = -1
    let kind = ''

    const consider = (at: number, label: string): void => {
      if (at !== -1 && (next === -1 || at < next)) {
        next = at
        kind = label
      }
    }

    consider(openAt, 'open')
    consider(closeAt, 'close')
    consider(listAt, 'nest')
    consider(listCloseAt, 'unnest')
    consider(orderedAt, 'nest')
    consider(orderedCloseAt, 'unnest')

    if (next === -1) {
      break
    }

    if (kind === 'open') {
      const end = findTagEnd(innerHtml, next)

      if (end === -1) {
        break
      }

      if (depth === 0) {
        openTag = innerHtml.slice(next, end + 1)
        innerStart = end + 1
      }

      depth += 1
      cursor = end + 1
      continue
    }

    if (kind === 'nest') {
      const end = findTagEnd(innerHtml, next)

      if (end === -1) {
        break
      }

      depth += 1
      cursor = end + 1
      continue
    }

    if (kind === 'close' || kind === 'unnest') {
      if (depth > 0) {
        depth -= 1
      }

      if (kind === 'close' && depth === 0 && openTag.length > 0) {
        out.push({
          group: readLiAttribute(openTag, 'data-group'),
          openTag,
          inner: innerHtml.slice(innerStart, next)
        })
        openTag = ''
      }

      cursor = next + (kind === 'close' ? 5 : 6)
      continue
    }

    cursor = next + 1
  }

  return out
}

function stripGenerated(innerHtml: string): string {
  const withoutInputs = innerHtml.replace(/<input[^>]*data-aha-generated="true"[^>]*>/gs, '')

  const withoutProgress = withoutInputs.replace(
    /<li[^>]*data-aha-generated="true"[^>]*>.*?<\/li>/gs,
    ''
  )

  return withoutProgress
}

function itemLabel(inner: string): string {
  const text = inner
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= 80) {
    return text
  }

  return `${text.slice(0, 77)}...`
}

function renderChecklist(request: MarkupRenderRequest): Effect.Effect<string, BlockDecodeError> {
  const clean = stripGenerated(request.innerHtml)
  const items = splitCheckItems(clean)

  if (items.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'checklist',
        path: 'children',
        detail: 'expected at least one li item'
      })
    )
  }

  let checkable = 0
  let body = ''

  for (const item of items) {
    if (item.group !== null) {
      body += `<li class="ck-group" data-group="${escapeAttr(item.group)}">${escapeHtml(item.group)}</li>`
      continue
    }

    const boxId = `${request.idPrefix}-c${String(checkable)}`
    checkable += 1
    body += `<li class="item"><input class="ck" data-aha-generated="true" type="checkbox" id="${escapeAttr(boxId)}" aria-label="${escapeAttr(itemLabel(item.inner))}">${item.inner}</li>`
  }

  if (checkable === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'checklist',
        path: 'children',
        detail: 'expected at least one li item besides group rows'
      })
    )
  }

  const progress = `<li class="ck-progress" data-aha-generated="true" aria-live="polite">0 of ${String(checkable)}</li>`

  return Effect.succeed(
    `<ul data-aha="checklist" class="aha-checklist" data-checklist-id="${escapeAttr(request.idPrefix)}">${progress}${body}</ul>`
  )
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'launch-morning',
    title: 'Launch morning',
    caption: 'Seven items in two groups; the count goes live with scripts.',
    json: null,
    markup: [
      '<li data-group="Before the flag"></li>',
      '<li>Suite green on a clean checkout</li>',
      '<li>Flag off in production</li>',
      '<li>Error budget above 20%</li>',
      '<li data-group="After the flag"></li>',
      '<li>Staff traffic clean for fifteen minutes</li>',
      '<li>Changelog entry names the flag</li>',
      '<li>Rollback step written down</li>',
      '<li>Graphs settled before lunch</li>'
    ].join('\n'),
    markupKind: null
  }
]

export const checklistComponent: CatalogComponent = {
  name: 'checklist',
  category: 'interactive',
  summary: 'Checkable items in optional groups with a live progress count.',
  inputKind: 'markup',
  markupTag: 'ul',
  fields: CHECKLIST_FIELDS,
  css: CHECKLIST_CSS,
  clientBundle: 'checklist.client.js',
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderChecklist
}
