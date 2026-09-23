import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { ScalableListInput, ScalableListItem } from './scalable-list-schema.js'

/**
 * Scalable-list renderer. Quantities for a base yield; the browser
 * client rescales them live with the same rounding rules exported here.
 * Without scripts the list reads at the base yield. Pure builders, no
 * DOM.
 */

export interface ScalableListRenderOptions {
  readonly idPrefix: string
}

/** Rescale one quantity to the current yield with per-unit rounding:
 * grams and millilitres to the nearest 5 above 20, spoons to quarters,
 * pieces to halves, kilos and litres to two decimals, whole pieces and
 * eggs to integers with a minimum of 1. Total: non-finite and zero
 * quantities stay 0. */
export function roundScaled(scaled: number, unit: string, whole: boolean): number {
  if (!Number.isFinite(scaled) || scaled <= 0) {
    return 0
  }

  if (whole || unit === 'eggs') {
    return Math.max(1, Math.round(scaled))
  }

  if (unit === 'g' || unit === 'ml') {
    if (scaled >= 20) {
      return Math.round(scaled / 5) * 5
    }

    return Math.round(scaled)
  }

  if (unit === 'tsp' || unit === 'tbsp') {
    return Math.round(scaled * 4) / 4
  }

  if (unit === 'pcs') {
    return Math.max(0.5, Math.round(scaled * 2) / 2)
  }

  if (unit === 'kg' || unit === 'l') {
    return Math.round(scaled * 100) / 100
  }

  return Math.round(scaled * 10) / 10
}

/** Compact quantity text: integers plain, fractions trimmed to two
 * decimals. Total on non-finite input. */
export function formatScaled(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const rounded = Math.round(value)

  if (rounded === value) {
    return String(rounded)
  }

  const hundredths = Math.round(value * 100) / 100
  let text = String(hundredths)

  if (text.indexOf('.') !== -1) {
    while (text.endsWith('0')) {
      text = text.slice(0, -1)
    }

    if (text.endsWith('.')) {
      text = text.slice(0, -1)
    }
  }

  return text
}

export function scaleQuantity(
  baseQty: number,
  baseServes: number,
  currentServes: number,
  unit: string,
  whole: boolean
): string {
  if (!Number.isFinite(baseServes) || baseServes <= 0) {
    return formatScaled(baseQty)
  }

  const scaled = roundScaled((baseQty * currentServes) / baseServes, unit, whole)

  if (unit.length === 0) {
    return formatScaled(scaled)
  }

  return `${formatScaled(scaled)} ${unit}`
}

function renderItem(item: ScalableListItem): string {
  const note = item.note === undefined ? '' : ` <span class="note">${escapeHtml(item.note)}</span>`

  if (item.qty === null) {
    return `<li><span class="q taste">to taste</span><span class="n">${escapeHtml(item.name)}${note}</span></li>`
  }

  const unit = item.unit ?? ''
  const whole = item.whole ?? false
  const text = unit.length === 0 ? formatScaled(item.qty) : `${formatScaled(item.qty)} ${unit}`

  return `<li><span class="q" data-base="${escapeAttr(String(item.qty))}" data-unit="${escapeAttr(unit)}" data-whole="${whole ? '1' : ''}">${escapeHtml(text)}</span><span class="n">${escapeHtml(item.name)}${note}</span></li>`
}

export function renderScalableList(
  input: ScalableListInput,
  options: ScalableListRenderOptions
): string {
  const label = input.servesLabel ?? 'servings'
  let presets = ''

  for (const preset of input.presets ?? []) {
    presets += `<button type="button" data-set="${escapeAttr(String(preset))}">${escapeHtml(String(preset))}</button>`
  }

  const presetWrap =
    presets.length === 0
      ? ''
      : `<span class="presets" role="group" aria-label="Preset yields">${presets}</span>`

  let items = ''

  for (const item of input.items) {
    items += renderItem(item)
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-scale" data-scale="scalable-list" data-scale-id="${escapeAttr(options.idPrefix)}" data-serves="${escapeAttr(String(input.serves))}" data-label="${escapeAttr(label)}">${title}<p class="sc-yield">Serves <span class="sc-cur">${escapeHtml(String(input.serves))} ${escapeHtml(label)}</span></p><div class="sc-ctl" hidden><button type="button" data-step="-1" aria-label="Serve one fewer">−</button><output>Serves ${escapeHtml(String(input.serves))} ${escapeHtml(label)}</output><button type="button" data-step="1" aria-label="Serve one more">+</button>${presetWrap}</div><ul class="sc-items">${items}</ul></div>`
}
