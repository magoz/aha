import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { Claim, ClaimsInput } from './claims-schema.js'

/**
 * Claims renderer. Findings with a text-plus-glyph confidence badge and
 * [n] citation links into the page's sources anchors. Citation numbers
 * follow first-mention order across the block. Pure builders, no DOM.
 */

export interface ClaimsRenderOptions {
  readonly idPrefix: string
}

export function orderSourceIds(claims: ReadonlyArray<Claim>): ReadonlyArray<string> {
  const out: Array<string> = []

  for (const claim of claims) {
    if (claim.sources === undefined) {
      continue
    }

    for (const id of claim.sources) {
      if (!out.includes(id)) {
        out.push(id)
      }
    }
  }

  return out
}

function glyphFor(confidence: string): string {
  if (confidence === 'high') {
    return '●'
  }

  if (confidence === 'medium') {
    return '◐'
  }

  return '○'
}

function renderCites(
  sources: ReadonlyArray<string> | undefined,
  order: ReadonlyArray<string>
): string {
  if (sources === undefined || sources.length === 0) {
    return ''
  }

  let cites = ''

  for (const id of sources) {
    const number = order.indexOf(id) + 1

    if (number < 1) {
      continue
    }

    cites += `<a class="cite" href="#${escapeAttr(`src-${id}`)}">[${String(number)}]</a>`
  }

  if (cites.length === 0) {
    return ''
  }

  return ` ${cites}`
}

export function renderClaims(input: ClaimsInput, options: ClaimsRenderOptions): string {
  const order = orderSourceIds(input.claims)
  let items = ''

  for (const claim of input.claims) {
    items += `<li><p class="statement">${escapeHtml(claim.statement)}${renderCites(claim.sources, order)}</p><p class="conf-row"><span class="conf conf-${escapeAttr(claim.confidence)}"><span aria-hidden="true">${glyphFor(claim.confidence)}</span> ${escapeHtml(claim.confidence)}</span></p></li>`
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-claims" data-claims="claims" data-claims-id="${escapeAttr(options.idPrefix)}">${title}<ul class="claim-list">${items}</ul></div>`
}
