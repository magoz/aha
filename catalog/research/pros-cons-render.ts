import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { ProsConsInput } from './pros-cons-schema.js'

/**
 * Pros-cons renderer. Two columns that stack inside narrow containers,
 * optional per-item mono weight markers, and an optional verdict line.
 * Pure builders, no DOM.
 */

export interface ProsConsRenderOptions {
  readonly idPrefix: string
}

interface WeightedItem {
  readonly text: string
  readonly weight?: string | undefined
}

function renderColumn(label: string, sign: string, items: ReadonlyArray<WeightedItem>): string {
  let rows = ''

  for (const item of items) {
    const weight =
      item.weight === undefined || item.weight.trim().length === 0
        ? ''
        : ` <span class="wt">${escapeHtml(item.weight.trim())}</span>`

    rows += `<li><span class="sign" aria-hidden="true">${sign}</span><span class="tx">${escapeHtml(item.text)}${weight}</span></li>`
  }

  return `<section class="col"><p class="k">${label}</p><ul>${rows}</ul></section>`
}

export function renderProsCons(input: ProsConsInput, options: ProsConsRenderOptions): string {
  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  const verdict =
    input.verdict === undefined || input.verdict.trim().length === 0
      ? ''
      : `<p class="verdict"><span class="k">Verdict</span> ${escapeHtml(input.verdict.trim())}</p>`

  return `<div class="aha-proscons" data-proscons="pros-cons" data-proscons-id="${escapeAttr(options.idPrefix)}">${title}<div class="pc-grid">${renderColumn('Pros', '+', input.pros)}${renderColumn('Cons', '−', input.cons)}</div>${verdict}</div>`
}
