import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { DecisionRecordInput } from './decision-record-schema.js'

/**
 * Decision-record renderer. An ADR in one block: status badge, context,
 * options with the chosen one in the accent, the decision, and signed
 * consequence lists. Pure builders, no DOM.
 */

export interface DecisionRecordRenderOptions {
  readonly idPrefix: string
}

function statusGlyph(status: string): string {
  if (status === 'accepted') {
    return '✓'
  }

  if (status === 'superseded') {
    return '✕'
  }

  return '?'
}

function renderOptions(input: DecisionRecordInput): string {
  let items = ''

  for (const option of input.options) {
    const chosen = option.name === input.decision.option
    const mark = chosen ? ' <span class="picked">chosen</span>' : ''
    const cls = chosen ? ' class="chosen"' : ''
    items += `<li${cls}><p class="o-name">${escapeHtml(option.name)}${mark}</p><p class="o-sum">${escapeHtml(option.summary)}</p></li>`
  }

  return `<ul class="opts">${items}</ul>`
}

function renderConsequences(input: DecisionRecordInput): string {
  let items = ''

  for (const line of input.consequences.positive) {
    items += `<li class="plus"><span aria-hidden="true">+</span> ${escapeHtml(line)}</li>`
  }

  for (const line of input.consequences.negative) {
    items += `<li class="minus"><span aria-hidden="true">−</span> ${escapeHtml(line)}</li>`
  }

  if (items.length === 0) {
    return ''
  }

  return `<p class="k">Consequences</p><ul class="cons">${items}</ul>`
}

export function renderDecisionRecord(
  input: DecisionRecordInput,
  options: DecisionRecordRenderOptions
): string {
  const date =
    input.date === undefined || input.date.trim().length === 0
      ? ''
      : ` <span class="date">${escapeHtml(input.date.trim())}</span>`

  return `<div class="aha-decision" data-decision="decision-record" data-decision-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">${escapeHtml(input.title)}</p><p class="dec-head"><span class="badge st-${escapeAttr(input.status)}"><span aria-hidden="true">${statusGlyph(input.status)}</span> ${escapeHtml(input.status)}</span>${date}</p><p class="k">Context</p><p class="ctx">${escapeHtml(input.context)}</p><p class="k">Options</p>${renderOptions(input)}<p class="k">Decision</p><p class="dec"><strong>${escapeHtml(input.decision.option)}.</strong> ${escapeHtml(input.decision.why)}</p>${renderConsequences(input)}</div>`
}
