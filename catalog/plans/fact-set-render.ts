import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { FactGroup, FactItem, FactSetInput } from './fact-set-schema.js'

/**
 * Fact-set renderer. A compact key-value spec sheet: keys as muted mono
 * labels, values with muted mono units, two columns in wide containers
 * through a container query. Pure builders, no DOM.
 */

export interface FactSetRenderOptions {
  readonly idPrefix: string
}

function renderItem(item: FactItem): string {
  const unit = item.unit === undefined ? '' : ` <span class="unit">${escapeHtml(item.unit)}</span>`
  const note = item.note === undefined ? '' : `<span class="note">${escapeHtml(item.note)}</span>`

  return `<dt>${escapeHtml(item.key)}</dt><dd><span class="v">${escapeHtml(item.value)}${unit}</span>${note}</dd>`
}

function renderList(items: ReadonlyArray<FactItem>): string {
  let body = ''

  for (const item of items) {
    body += renderItem(item)
  }

  if (items.length % 2 === 1) {
    body += '<dt class="fill" aria-hidden="true"></dt><dd class="fill" aria-hidden="true"></dd>'
  }

  return `<dl class="facts">${body}</dl>`
}

export function countFacts(
  items: ReadonlyArray<FactItem>,
  groups: ReadonlyArray<FactGroup>
): number {
  let total = items.length

  for (const group of groups) {
    total += group.items.length
  }

  return total
}

export function renderFactSet(input: FactSetInput, options: FactSetRenderOptions): string {
  const items = input.items ?? []
  const groups = input.groups ?? []
  let body = ''

  if (items.length > 0) {
    body += renderList(items)
  }

  for (const group of groups) {
    body += `<section class="f-group"><h3 class="g-name">${escapeHtml(group.name)}</h3>${renderList(group.items)}</section>`
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-facts" data-facts="fact-set" data-facts-id="${escapeAttr(options.idPrefix)}">${title}${body}</div>`
}
