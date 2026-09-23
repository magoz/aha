import { formatFullDate, formatNumberValue } from '../shared/format.js'
import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { DataTableCell, DataTableInput } from './data-table-schema.js'

/**
 * Data-table renderer. Typed columns format in Node and re-format in the
 * browser client when headers sort. Pure builders, no DOM.
 */

export const DATA_TABLE_DEFAULT_COLLAPSE = 12

export interface DataTableRenderOptions {
  readonly idPrefix: string
}

function isCellNumber(cell: DataTableCell): cell is number {
  if (cell === true || cell === false || cell === null) {
    return false
  }

  return cell === Number(cell) && Number.isFinite(Number(cell))
}

function isTextCell(cell: DataTableCell): cell is string {
  return cell === String(cell)
}

function formatCell(
  cell: DataTableCell,
  type: string,
  currency: string | undefined,
  digits: number | undefined
): string {
  if (cell === null) {
    return '—'
  }

  if (type === 'number') {
    if (!isCellNumber(cell)) {
      return escapeHtml(String(cell))
    }

    return escapeHtml(
      formatNumberValue(cell, { style: 'decimal', currency: null, digits: digits ?? null })
    )
  }

  if (type === 'currency') {
    if (!isCellNumber(cell)) {
      return escapeHtml(String(cell))
    }

    return escapeHtml(
      formatNumberValue(cell, {
        style: 'currency',
        currency: currency ?? 'USD',
        digits: digits ?? 2
      })
    )
  }

  if (type === 'percent') {
    if (!isJsonNumberCell(cell)) {
      return escapeHtml(String(cell))
    }

    return escapeHtml(
      formatNumberValue(cell, { style: 'percent', currency: null, digits: digits ?? 1 })
    )
  }

  if (type === 'date') {
    if (isTextCell(cell)) {
      const millis = Date.parse(cell)

      if (!Number.isNaN(millis)) {
        return escapeHtml(formatFullDate(millis))
      }

      return escapeHtml(cell)
    }

    if (isJsonNumberCell(cell)) {
      return escapeHtml(formatFullDate(cell))
    }

    return escapeHtml(String(cell))
  }

  return escapeHtml(String(cell))
}

function isJsonNumberCell(cell: DataTableCell): cell is number {
  return isCellNumber(cell)
}

function cellSortKey(cell: DataTableCell, type: string): number | string {
  if (cell === null) {
    return ''
  }

  if ((type === 'number' || type === 'currency' || type === 'percent') && isCellNumber(cell)) {
    return cell
  }

  if (type === 'date' && isTextCell(cell)) {
    const millis = Date.parse(cell)

    if (!Number.isNaN(millis)) {
      return millis
    }

    return cell
  }

  if (type === 'date' && isCellNumber(cell)) {
    return cell
  }

  return String(cell)
}

function numericColumn(type: string): boolean {
  return type === 'number' || type === 'currency' || type === 'percent'
}

function columnClasses(type: string, priority: string | undefined): string {
  const classes: Array<string> = []

  if (numericColumn(type)) {
    classes.push('num')
  }

  if (type === 'date') {
    classes.push('dt')
  }

  if (priority === 'low') {
    classes.push('low')
  }

  if (classes.length === 0) {
    return ''
  }

  return ` class="${classes.join(' ')}"`
}

export function renderDataTable(input: DataTableInput, options: DataTableRenderOptions): string {
  const collapseAfter = input.collapseAfter ?? DATA_TABLE_DEFAULT_COLLAPSE
  const highlight = input.highlightRow ?? -1

  let head = '<thead><tr>'

  for (let index = 0; index < input.columns.length; index += 1) {
    const column = input.columns[index]

    if (column === undefined) {
      continue
    }

    const label = column.label ?? column.key
    const cellClass = columnClasses(column.type, column.priority)

    if ((input.sortable ?? false) && input.columns.length > 0) {
      head += `<th${cellClass} data-sort="${String(index)}" tabindex="0" role="columnheader">${escapeHtml(label)} <span class="sort-arrow" aria-hidden="true"></span></th>`
    } else {
      head += `<th${cellClass}>${escapeHtml(label)}</th>`
    }
  }

  head += '</tr></thead>'

  const renderRow = (rowIndex: number): string => {
    const row = input.rows[rowIndex]

    if (row === undefined) {
      return ''
    }

    const rec = rowIndex === highlight ? ' class="rec"' : ''
    let html = `<tr${rec}>`

    for (let colIndex = 0; colIndex < input.columns.length; colIndex += 1) {
      const column = input.columns[colIndex]

      if (column === undefined) {
        continue
      }

      const cell: DataTableCell = row[colIndex] ?? null
      const bodyClass = columnClasses(column.type, column.priority)
      const sortKey = cellSortKey(cell, column.type)

      const keyAttr = isCellNumber(sortKey)
        ? ` data-key="${String(sortKey)}"`
        : ` data-key="${escapeAttr(sortKey)}"`

      html += `<td${bodyClass}${keyAttr}>${formatCell(cell, column.type, column.currency, column.digits)}</td>`
    }

    html += '</tr>'

    return html
  }

  let firstBody = '<tbody>'
  let restBody = ''

  for (let rowIndex = 0; rowIndex < input.rows.length; rowIndex += 1) {
    if (rowIndex < collapseAfter) {
      firstBody += renderRow(rowIndex)
    } else {
      restBody += renderRow(rowIndex)
    }
  }

  firstBody += '</tbody>'

  let tables = `<table>${head}${firstBody}</table>`

  if (restBody.length > 0) {
    const remaining = input.rows.length - collapseAfter
    tables += `<details class="aha-more"><summary>Show ${String(remaining)} more rows</summary><table>${head}<tbody>${restBody}</tbody></table></details>`
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  const sortable = (input.sortable ?? false) ? ' data-sortable="true"' : ''

  return `<div class="aha-table" data-table="data-table" data-table-id="${escapeAttr(options.idPrefix)}"${sortable}>${title}<div class="tw">${tables}</div></div>`
}
