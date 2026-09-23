/**
 * Risk-matrix browser client. Hovering or focusing a grid marker
 * highlights its list row and vice versa, through one shared index.
 * The static grid and list already read fully without scripts.
 * No Effect or Schema here.
 */

function setHot(root: HTMLElement, index: string, on: boolean): void {
  const marked = root.querySelectorAll('[data-mk]')
  const rows = root.querySelectorAll('[data-row]')

  for (let position = 0; position < marked.length; position += 1) {
    const node = marked.item(position)

    if (node instanceof HTMLElement && node.getAttribute('data-mk') === index) {
      if (on) {
        node.classList.add('hot')
      } else {
        node.classList.remove('hot')
      }
    }
  }

  for (let position = 0; position < rows.length; position += 1) {
    const node = rows.item(position)

    if (node instanceof HTMLElement && node.getAttribute('data-row') === index) {
      if (on) {
        node.classList.add('hot')
      } else {
        node.classList.remove('hot')
      }
    }
  }
}

function clearHot(root: HTMLElement): void {
  const hot = root.querySelectorAll('.hot')

  for (let position = 0; position < hot.length; position += 1) {
    const node = hot.item(position)

    if (node instanceof HTMLElement) {
      node.classList.remove('hot')
    }
  }
}

function indexFor(target: HTMLElement | null): string | null {
  if (target === null) {
    return null
  }

  const marker = target.closest('[data-mk]')

  if (marker instanceof HTMLElement) {
    return marker.getAttribute('data-mk')
  }

  const row = target.closest('[data-row]')

  if (row instanceof HTMLElement) {
    return row.getAttribute('data-row')
  }

  return null
}

function initRisk(root: HTMLElement): void {
  root.addEventListener('mouseover', (event) => {
    if (event.target instanceof HTMLElement) {
      const index = indexFor(event.target)

      if (index !== null) {
        clearHot(root)
        setHot(root, index, true)
      }
    }
  })

  root.addEventListener('mouseleave', () => {
    clearHot(root)
  })

  root.addEventListener('focusin', (event) => {
    if (event.target instanceof HTMLElement) {
      const index = indexFor(event.target)

      if (index !== null) {
        clearHot(root)
        setHot(root, index, true)
      }
    }
  })

  root.addEventListener('focusout', () => {
    clearHot(root)
  })
}

function initAllRisks(): void {
  const roots = document.querySelectorAll('.aha-risk[data-risk-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      initRisk(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllRisks)
} else {
  initAllRisks()
}
