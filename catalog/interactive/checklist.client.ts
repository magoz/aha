/**
 * Checklist browser client. Counts checked boxes per list and rewrites
 * the static progress line; state lives in the DOM only, never in
 * storage (the sandboxed page forbids it). Boxes already toggle without
 * scripts. No Effect or Schema here.
 */

function refreshList(list: HTMLElement): void {
  const boxes = list.querySelectorAll('input.ck[type="checkbox"]')
  let total = 0
  let done = 0

  for (let index = 0; index < boxes.length; index += 1) {
    const node = boxes.item(index)

    if (node instanceof HTMLInputElement) {
      total += 1

      if (node.checked) {
        done += 1
      }
    }
  }

  const progress = list.querySelector('.ck-progress')

  if (progress !== null) {
    progress.textContent = `${String(done)} of ${String(total)}`
  }
}

function initChecklist(list: HTMLElement): void {
  list.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement) {
      refreshList(list)
    }
  })

  refreshList(list)
}

function initAllChecklists(): void {
  const lists = document.querySelectorAll('ul.aha-checklist[data-checklist-id]')

  for (let index = 0; index < lists.length; index += 1) {
    const list = lists.item(index)

    if (list instanceof HTMLElement) {
      initChecklist(list)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllChecklists)
} else {
  initAllChecklists()
}
