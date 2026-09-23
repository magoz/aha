import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { SourceEntry, SourcesInput } from './sources-schema.js'

/**
 * Sources renderer. A compact ordered reference list: the number carries
 * the citation, the URL stays visible in mono, and entries with an id
 * gain a stable src-<id> anchor for prose and claims links. Pure
 * builders, no DOM.
 */

export interface SourcesRenderOptions {
  readonly idPrefix: string
}

export function anchorFor(entry: SourceEntry, index: number): string {
  if (entry.id !== undefined && entry.id.trim().length > 0) {
    return `src-${entry.id.trim()}`
  }

  return `src-${String(index + 1)}`
}

function renderMeta(entry: SourceEntry): string {
  let meta = escapeHtml(entry.publisher)

  if (entry.published !== undefined && entry.published.trim().length > 0) {
    meta += ` · published ${escapeHtml(entry.published.trim())}`
  }

  if (entry.observed !== undefined && entry.observed.trim().length > 0) {
    meta += ` · observed ${escapeHtml(entry.observed.trim())}`
  }

  return `<p class="src-meta">${meta}</p>`
}

export function renderSources(input: SourcesInput, options: SourcesRenderOptions): string {
  let items = ''

  for (let index = 0; index < input.sources.length; index += 1) {
    const entry = input.sources[index]

    if (entry === undefined) {
      continue
    }

    const anchor = anchorFor(entry, index)
    items += `<li id="${escapeAttr(anchor)}"><p class="src-t"><span class="n" aria-hidden="true">[${String(index + 1)}]</span> ${escapeHtml(entry.title)}</p>${renderMeta(entry)}<p class="src-sup">${escapeHtml(entry.supports)}</p><p class="src-url"><a href="${escapeAttr(entry.url)}">${escapeHtml(entry.url)}</a></p></li>`
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-sources" data-sources="sources" data-sources-id="${escapeAttr(options.idPrefix)}">${title}<ol class="src-list">${items}</ol></div>`
}
