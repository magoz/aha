/**
 * Faq browser client. Adds one Expand all / Collapse all control above
 * the disclosures; without scripts the native details elements work on
 * their own. No Effect or Schema here.
 */

function initFaq(root: HTMLElement): void {
  if (root.querySelector('.faq-ctl') !== null) {
    return
  }

  const items: Array<HTMLDetailsElement> = []
  const found = root.querySelectorAll(':scope > details')

  for (let index = 0; index < found.length; index += 1) {
    const node = found.item(index)

    if (node instanceof HTMLDetailsElement) {
      items.push(node)
    }
  }

  if (items.length < 2) {
    return
  }

  const control = document.createElement('div')
  control.className = 'faq-ctl'

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Expand all'

  button.addEventListener('click', () => {
    let anyClosed = false

    for (const item of items) {
      if (!item.open) {
        anyClosed = true
        break
      }
    }

    for (const item of items) {
      item.open = anyClosed
    }

    button.textContent = anyClosed ? 'Collapse all' : 'Expand all'
  })

  control.appendChild(button)

  const first = root.firstChild

  if (first === null) {
    root.appendChild(control)
  } else {
    root.insertBefore(control, first)
  }
}

function initAllFaqs(): void {
  const roots = document.querySelectorAll('.aha-faq[data-faq-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      initFaq(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllFaqs)
} else {
  initAllFaqs()
}
