import { escapeAttr, escapeHtml, linePath } from '../shared/svg.js'
import type { PlotPoint } from '../shared/svg.js'
import type { KeyFigure, KeyFiguresInput } from './key-figures-schema.js'

/**
 * Key-figures renderer. Hairline grid of mono headline numbers with signed
 * deltas and inline SVG sparklines. Pure builders, no DOM.
 */

export interface KeyFiguresRenderOptions {
  readonly idPrefix: string
}

const SPARK_WIDTH = 96

const SPARK_HEIGHT = 24

function arrowFor(direction: string | undefined): string {
  if (direction === 'up') {
    return '▲'
  }

  if (direction === 'down') {
    return '▼'
  }

  if (direction === 'flat') {
    return '●'
  }

  return ''
}

function renderDelta(figure: KeyFigure): string {
  if (figure.delta === undefined) {
    return ''
  }

  const arrow = arrowFor(figure.direction)
  const glyph = arrow.length === 0 ? '' : `<span class="arr" aria-hidden="true">${arrow}</span> `

  return `<p class="delta">${glyph}${escapeHtml(figure.delta)}</p>`
}

function sparkPath(trend: ReadonlyArray<number>): string {
  if (trend.length === 0) {
    return ''
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const value of trend) {
    if (value < min) {
      min = value
    }

    if (value > max) {
      max = value
    }
  }

  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) {
    return ''
  }

  if (min === max) {
    min -= 1
    max += 1
  }

  const span = max - min
  const points: Array<PlotPoint> = []

  for (let index = 0; index < trend.length; index += 1) {
    const value = trend[index]

    if (value === undefined) {
      continue
    }

    const x = trend.length === 1 ? SPARK_WIDTH / 2 : (index / (trend.length - 1)) * SPARK_WIDTH
    const y = SPARK_HEIGHT - 2 - ((value - min) / span) * (SPARK_HEIGHT - 4)
    points.push({ x, y })
  }

  return linePath(points)
}

function renderSpark(figure: KeyFigure): string {
  if (figure.trend === undefined || figure.trend.length < 2) {
    return ''
  }

  const path = sparkPath(figure.trend)

  if (path.length === 0) {
    return ''
  }

  const last = figure.trend[figure.trend.length - 1]
  const first = figure.trend[0]

  const summary =
    last === undefined || first === undefined
      ? ''
      : ` Trend from ${String(first)} to ${String(last)}.`

  return `<svg class="spark" viewBox="0 0 ${String(SPARK_WIDTH)} ${String(SPARK_HEIGHT)}" role="img" aria-label="Trend for ${escapeAttr(figure.label)}.${escapeAttr(summary)}"><path d="${path}"/></svg>`
}

export function renderKeyFigures(input: KeyFiguresInput, options: KeyFiguresRenderOptions): string {
  let items = ''

  for (const figure of input.figures) {
    const unit =
      figure.unit === undefined ? '' : `<span class="unit">${escapeHtml(figure.unit)}</span>`

    items += `<li><p class="k-label">${escapeHtml(figure.label)}</p><p class="k-value">${escapeHtml(figure.value)}${unit}</p>${renderDelta(figure)}${renderSpark(figure)}</li>`
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-figures" data-figures="key-figures" data-figures-id="${escapeAttr(options.idPrefix)}">${title}<ul class="fig-grid">${items}</ul></div>`
}
