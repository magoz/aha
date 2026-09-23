/**
 * File-tree browser client. Folder buttons collapse and expand their
 * child list; without scripts every folder stays expanded.
 * No Effect or Schema here.
 */

function setCollapsed(button: HTMLElement, collapsed: boolean): void {
  const item = button.parentElement

  if (item === null) {
    return
  }

  const list = item.querySelector(':scope > ul')

  if (!(list instanceof HTMLElement)) {
    return
  }

  button.setAttribute('aria-expanded', collapsed ? 'false' : 'true')

  if (collapsed) {
    list.setAttribute('hidden', '')
  } else {
    list.removeAttribute('hidden')
  }

  const twisty = button.querySelector('.twisty')

  if (twisty !== null) {
    twisty.textContent = collapsed ? '▸' : '▾'
  }
}

function initTree(root: HTMLElement): void {
  if (root.getAttribute('data-ftree-live') === 'true') {
    return
  }

  root.setAttribute('data-ftree-live', 'true')

  const buttons = root.querySelectorAll('.dirname')

  for (let index = 0; index < buttons.length; index += 1) {
    const node = buttons.item(index)

    if (!(node instanceof HTMLElement)) {
      continue
    }

    const button = node

    button.addEventListener('click', () => {
      setCollapsed(button, button.getAttribute('aria-expanded') === 'true')
    })
  }
}

function initAllTrees(): void {
  const roots = document.querySelectorAll('.aha-ftree[data-ftree-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      initTree(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllTrees)
} else {
  initAllTrees()
}
