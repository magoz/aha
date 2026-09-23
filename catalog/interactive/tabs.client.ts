/**
 * Tabs browser client. Builds an accessible tablist over the static
 * sections: arrow keys move between tabs, Home/End jump, panels hide with
 * the hidden attribute. Without scripts every section stays visible.
 * No Effect or Schema here.
 */

function selectTab(root: HTMLElement, index: number): void {
  const list = root.querySelector('.tab-list')

  if (list === null) {
    return
  }

  const tabs: Array<HTMLElement> = []
  const buttons = list.querySelectorAll('[role="tab"]')

  for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
    const node = buttons.item(buttonIndex)

    if (node instanceof HTMLElement) {
      tabs.push(node)
    }
  }

  const panels: Array<HTMLElement> = []
  const sections = root.querySelectorAll(':scope > section[data-tab]')

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const node = sections.item(sectionIndex)

    if (node instanceof HTMLElement) {
      panels.push(node)
    }
  }

  for (let position = 0; position < tabs.length; position += 1) {
    const tab = tabs[position]
    const panel = panels[position]

    if (tab === undefined || panel === undefined) {
      continue
    }

    const active = position === index
    tab.setAttribute('aria-selected', active ? 'true' : 'false')
    tab.tabIndex = active ? 0 : -1

    if (active) {
      panel.removeAttribute('hidden')
    } else {
      panel.setAttribute('hidden', '')
    }
  }
}

function initTabs(root: HTMLElement, rootId: string): void {
  const sections: Array<HTMLElement> = []
  const found = root.querySelectorAll(':scope > section[data-tab]')

  for (let index = 0; index < found.length; index += 1) {
    const node = found.item(index)

    if (node instanceof HTMLElement) {
      sections.push(node)
    }
  }

  if (sections.length === 0) {
    return
  }

  const list = document.createElement('div')
  list.className = 'tab-list'
  list.setAttribute('role', 'tablist')

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index]

    if (section === undefined) {
      continue
    }

    const label = section.getAttribute('data-tab') ?? `Tab ${String(index + 1)}`
    const tabId = `${rootId}-tab-${String(index)}`
    const panelId = `${rootId}-panel-${String(index)}`

    const button = document.createElement('button')
    button.setAttribute('role', 'tab')
    button.setAttribute('id', tabId)
    button.setAttribute('aria-controls', panelId)
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false')
    button.tabIndex = index === 0 ? 0 : -1
    button.textContent = label

    const at = index

    button.addEventListener('click', () => {
      selectTab(root, at)
    })

    button.addEventListener('keydown', (event) => {
      let next: number | null = null

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (at + 1) % sections.length
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (at - 1 + sections.length) % sections.length
      }

      if (event.key === 'Home') {
        next = 0
      }

      if (event.key === 'End') {
        next = sections.length - 1
      }

      if (next === null) {
        return
      }

      event.preventDefault()
      selectTab(root, next)

      const tabs = list.querySelectorAll('[role="tab"]')
      const target = tabs.item(next)

      if (target instanceof HTMLElement) {
        target.focus()
      }
    })

    list.appendChild(button)

    section.setAttribute('role', 'tabpanel')
    section.setAttribute('id', panelId)
    section.setAttribute('aria-labelledby', tabId)
    section.tabIndex = 0

    if (index > 0) {
      section.setAttribute('hidden', '')
    }
  }

  const first = root.firstChild

  if (first === null) {
    root.appendChild(list)
  } else {
    root.insertBefore(list, first)
  }
}

function initAllTabs(): void {
  const roots = document.querySelectorAll('.aha-tabs[data-tabs-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      if (root.querySelector('.tab-list') !== null) {
        continue
      }

      initTabs(root, root.getAttribute('data-tabs-id') ?? `tabs-${String(index)}`)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllTabs)
} else {
  initAllTabs()
}
