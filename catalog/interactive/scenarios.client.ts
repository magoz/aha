/**
 * Scenarios browser client. A segmented control switches between the
 * static sections; hidden sections use the hidden attribute so the no-JS
 * view stays fully readable. Revealing a section changes its size, which
 * fires the nested charts' ResizeObserver and re-renders them at the live
 * width. No Effect or Schema here.
 */

function showScenario(root: HTMLElement, index: number): void {
  const group = root.querySelector('.seg')

  if (group === null) {
    return
  }

  const buttons: Array<HTMLElement> = []
  const found = group.querySelectorAll('button')

  for (let buttonIndex = 0; buttonIndex < found.length; buttonIndex += 1) {
    const node = found.item(buttonIndex)

    if (node instanceof HTMLElement) {
      buttons.push(node)
    }
  }

  const sections: Array<HTMLElement> = []
  const panels = root.querySelectorAll(':scope > section[data-scenario]')

  for (let panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
    const node = panels.item(panelIndex)

    if (node instanceof HTMLElement) {
      sections.push(node)
    }
  }

  for (let position = 0; position < buttons.length; position += 1) {
    const button = buttons[position]
    const panel = sections[position]

    if (button === undefined || panel === undefined) {
      continue
    }

    const active = position === index
    button.setAttribute('aria-pressed', active ? 'true' : 'false')

    if (active) {
      panel.removeAttribute('hidden')
    } else {
      panel.setAttribute('hidden', '')
    }
  }
}

function initScenarios(root: HTMLElement): void {
  const sections: Array<HTMLElement> = []
  const found = root.querySelectorAll(':scope > section[data-scenario]')

  for (let index = 0; index < found.length; index += 1) {
    const node = found.item(index)

    if (node instanceof HTMLElement) {
      sections.push(node)
    }
  }

  if (sections.length === 0) {
    return
  }

  const group = document.createElement('div')
  group.className = 'seg'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Scenarios')

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index]

    if (section === undefined) {
      continue
    }

    const label = section.getAttribute('data-scenario') ?? `Scenario ${String(index + 1)}`
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false')

    const at = index

    button.addEventListener('click', () => {
      showScenario(root, at)
    })

    group.appendChild(button)

    if (index > 0) {
      section.setAttribute('hidden', '')
    }
  }

  const first = root.firstChild

  if (first === null) {
    root.appendChild(group)
  } else {
    root.insertBefore(group, first)
  }
}

function initAllScenarios(): void {
  const roots = document.querySelectorAll('.aha-scenarios[data-scenarios-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      if (root.querySelector('.seg') !== null) {
        continue
      }

      initScenarios(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllScenarios)
} else {
  initAllScenarios()
}
