/**
 * Annotated-code browser client. Hovering or focusing a note highlights
 * its code lines, and hovering or focusing a line highlights its notes.
 * The static markers and note list already read without scripts.
 * No Effect or Schema here.
 */

function clearHighlights(root: HTMLElement): void {
  const highlighted = root.querySelectorAll('.hl')

  for (let index = 0; index < highlighted.length; index += 1) {
    const node = highlighted.item(index)

    if (node instanceof HTMLElement) {
      node.classList.remove('hl')
    }
  }
}

function addHighlights(root: HTMLElement, selector: string): void {
  const matches = root.querySelectorAll(selector)

  for (let index = 0; index < matches.length; index += 1) {
    const node = matches.item(index)

    if (node instanceof HTMLElement) {
      node.classList.add('hl')
    }
  }
}

function highlightNote(root: HTMLElement, note: string): void {
  if (note.length === 0) {
    return
  }

  clearHighlights(root)
  addHighlights(root, `tr[data-notes~="${note}"]`)
  addHighlights(root, `li[data-note="${note}"]`)
}

function highlightLine(root: HTMLElement, line: string): void {
  if (line.length === 0) {
    return
  }

  clearHighlights(root)
  addHighlights(root, `tr[data-line="${line}"]`)

  const row = root.querySelector(`tr[data-line="${line}"]`)

  if (!(row instanceof HTMLElement)) {
    return
  }

  const token = row.getAttribute('data-notes') ?? ''
  const notes = token.split(' ')

  for (const note of notes) {
    if (note.length > 0) {
      addHighlights(root, `li[data-note="${note}"]`)
    }
  }
}

/** The hovered or focused code line or note, if any. */
function hitOf(target: HTMLElement | null): HTMLElement | null {
  if (target === null) {
    return null
  }

  const hit = target.closest('tr[data-line], li[data-note]')

  if (hit instanceof HTMLElement) {
    return hit
  }

  return null
}

function showFor(root: HTMLElement, hit: HTMLElement | null): void {
  if (hit === null) {
    clearHighlights(root)

    return
  }

  if (hit.tagName === 'LI') {
    highlightNote(root, hit.getAttribute('data-note') ?? '')

    return
  }

  highlightLine(root, hit.getAttribute('data-line') ?? '')
}

function initCode(root: HTMLElement): void {
  if (root.getAttribute('data-ancode-live') === 'true') {
    return
  }

  root.setAttribute('data-ancode-live', 'true')

  root.addEventListener('mouseover', (event) => {
    const target = event.target

    if (target instanceof HTMLElement) {
      showFor(root, hitOf(target))
    }
  })

  root.addEventListener('mouseout', (event) => {
    const target = event.target
    const related = event.relatedTarget

    const from = target instanceof HTMLElement ? hitOf(target) : null
    const to = related instanceof HTMLElement ? hitOf(related) : null

    if (from !== null && from === to) {
      return
    }

    if (to !== null) {
      showFor(root, to)

      return
    }

    clearHighlights(root)
  })

  root.addEventListener('focusin', (event) => {
    const target = event.target

    if (target instanceof HTMLElement) {
      showFor(root, hitOf(target))
    }
  })

  root.addEventListener('focusout', () => {
    clearHighlights(root)
  })
}

function initAllCode(): void {
  const roots = document.querySelectorAll('.aha-ancode[data-ancode-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      initCode(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllCode)
} else {
  initAllCode()
}
