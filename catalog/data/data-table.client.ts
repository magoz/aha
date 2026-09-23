/**
 * Data-table browser client. Sorts by sortable headers in place; the static
 * table already reads without scripts. No Effect or Schema here.
 */

function compareKeys(left: string, right: string, numeric: boolean): number {
  if (numeric) {
    const leftNum = Number(left)
    const rightNum = Number(right)
    const leftBad = Number.isNaN(leftNum)
    const rightBad = Number.isNaN(rightNum)

    if (leftBad && rightBad) {
      return 0
    }

    if (leftBad) {
      return 1
    }

    if (rightBad) {
      return -1
    }

    if (leftNum < rightNum) {
      return -1
    }

    if (leftNum > rightNum) {
      return 1
    }

    return 0
  }

  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}

function sortTable(table: HTMLTableElement, column: number, ascending: boolean): void {
  const bodies = table.tBodies

  for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
    const body = bodies.item(bodyIndex)

    if (body === null) {
      continue
    }

    const rows: Array<HTMLTableRowElement> = []

    for (let rowIndex = 0; rowIndex < body.rows.length; rowIndex += 1) {
      const row = body.rows.item(rowIndex)

      if (row !== null) {
        rows.push(row)
      }
    }

    const numeric = rows.length > 0 && (rows[0]?.cells[column]?.classList.contains('num') ?? false)

    rows.sort((left, right) => {
      const leftCell = left.cells[column]
      const rightCell = right.cells[column]

      const result = compareKeys(
        leftCell?.getAttribute('data-key') ?? leftCell?.textContent ?? '',
        rightCell?.getAttribute('data-key') ?? rightCell?.textContent ?? '',
        numeric
      )

      return ascending ? result : -result
    })

    for (const row of rows) {
      body.appendChild(row)
    }
  }
}

function markHeader(header: HTMLTableCellElement, ascending: boolean): void {
  const arrow = header.querySelector('.sort-arrow')

  if (arrow !== null) {
    arrow.textContent = ascending ? ' ▲' : ' ▼'
  }

  header.setAttribute('aria-sort', ascending ? 'ascending' : 'descending')
}

function clearArrows(table: HTMLTableElement): void {
  const arrows = table.querySelectorAll('.sort-arrow')

  for (let index = 0; index < arrows.length; index += 1) {
    const arrow = arrows.item(index)

    if (arrow !== null) {
      arrow.textContent = ''
    }
  }
}

function initTable(container: HTMLElement): void {
  if (container.getAttribute('data-sortable') !== 'true') {
    return
  }

  const tables = container.querySelectorAll('table')

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const table = tables.item(tableIndex)

    if (!(table instanceof HTMLTableElement)) {
      continue
    }

    const headers = table.querySelectorAll('th[data-sort]')
    let order = 0

    for (let headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
      const node = headers.item(headerIndex)

      if (!(node instanceof HTMLElement)) {
        continue
      }

      const header = node
      const raw = header.getAttribute('data-sort') ?? ''
      const column = Number.parseInt(raw, 10)

      if (!Number.isSafeInteger(column)) {
        continue
      }

      const activate = (): void => {
        order += 1
        const ascending = order % 2 === 1
        clearArrows(table)
        sortTable(table, column, ascending)

        if (header instanceof HTMLTableCellElement) {
          markHeader(header, ascending)
        }
      }

      header.addEventListener('click', activate)
      header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          activate()
        }
      })
    }
  }
}

function initTables(): void {
  const containers = document.querySelectorAll('.aha-table[data-sortable="true"]')

  for (let index = 0; index < containers.length; index += 1) {
    const container = containers.item(index)

    if (container instanceof HTMLElement) {
      initTable(container)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTables)
} else {
  initTables()
}
