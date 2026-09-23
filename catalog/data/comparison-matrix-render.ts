import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { ComparisonMatrixInput, MatrixCell } from './comparison-matrix-schema.js'

/**
 * Comparison-matrix renderer. Options by criteria with typed cells and an
 * optional recommended column. The first column sticks inside the scroll
 * wrapper on narrow containers. Pure builders, no DOM.
 */

export interface ComparisonMatrixRenderOptions {
  readonly idPrefix: string
}

function markGlyph(mark: string): string {
  if (mark === 'yes') {
    return '✓'
  }

  if (mark === 'partial') {
    return '◐'
  }

  return '—'
}

function markClass(mark: string): string {
  if (mark === 'yes') {
    return 'mk-yes'
  }

  if (mark === 'partial') {
    return 'mk-part'
  }

  return 'mk-no'
}

function readCellText(cell: MatrixCell): string | null {
  if ('text' in cell) {
    return cell.text
  }

  return null
}

function readCellMark(cell: MatrixCell): string | null {
  if ('mark' in cell) {
    return cell.mark
  }

  return null
}

function readCellNumber(cell: MatrixCell): number | null {
  if ('value' in cell) {
    const value = cell.value

    if (value === Number(value) && Number.isFinite(Number(value))) {
      return value
    }
  }

  return null
}

function readCellUnit(cell: MatrixCell): string | null {
  if ('unit' in cell) {
    return cell.unit ?? null
  }

  return null
}

function renderCell(cell: MatrixCell): string {
  const text = readCellText(cell)

  if (text !== null) {
    return `<td class="txt">${escapeHtml(text)}</td>`
  }

  const mark = readCellMark(cell)

  if (mark !== null) {
    return `<td class="mk ${markClass(mark)}"><span aria-hidden="true">${markGlyph(mark)}</span><span class="vh">${escapeHtml(mark)}</span></td>`
  }

  const value = readCellNumber(cell)

  if (value !== null) {
    const unit = readCellUnit(cell)
    const suffix = unit === null ? '' : `<span class="unit"> ${escapeHtml(unit)}</span>`

    return `<td class="num">${escapeHtml(String(value))}${suffix}</td>`
  }

  return '<td class="txt">—</td>'
}

export function renderComparisonMatrix(
  input: ComparisonMatrixInput,
  options: ComparisonMatrixRenderOptions
): string {
  let head = '<thead><tr><th scope="col"><span class="vh">criterion</span></th>'

  for (const option of input.options) {
    const rec = (option.recommended ?? false) ? ' class="rec"' : ''
    head += `<th scope="col"${rec}>${escapeHtml(option.name)}</th>`
  }

  head += '</tr></thead>'

  let body = '<tbody>'

  for (const row of input.rows) {
    body += `<tr><th scope="row">${escapeHtml(row.criterion)}</th>`

    for (const cell of row.cells) {
      body += renderCell(cell)
    }

    body += '</tr>'
  }

  body += '</tbody>'

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-matrix" data-matrix="comparison-matrix" data-matrix-id="${escapeAttr(options.idPrefix)}"><div class="tw">${title}<table>${head}${body}</table></div></div>`
}
