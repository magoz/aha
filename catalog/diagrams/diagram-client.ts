/**
 * Shared diagram interaction helper, bundled into the diagram clients.
 * Hovering or focusing a node highlights its edges and neighbours; tap
 * (click) pins the selection, Escape clears it, arrows move focus between
 * nodes. Messages in sequence diagrams are edges, so the same helper
 * highlights the actors a message runs between. Listeners delegate from
 * the stable root, so client re-renders that swap only the SVG keep
 * working. No Effect here, only DOM and arithmetic.
 */

interface Selection {
  readonly kind: 'node' | 'edge'
  readonly id: string
  readonly from: string
  readonly to: string
}

function eachElement(list: NodeListOf<Element>, apply: (node: Element) => void): void {
  for (let index = 0; index < list.length; index += 1) {
    const node = list.item(index)

    if (node !== null) {
      apply(node)
    }
  }
}

function closestSelection(target: EventTarget | null): Selection | null {
  if (!(target instanceof Element)) {
    return null
  }

  const node = target.closest('[data-node]')

  if (node !== null) {
    const id = node.getAttribute('data-node')

    if (id !== null) {
      return { kind: 'node', id, from: id, to: id }
    }
  }

  const edge = target.closest('[data-edge]')

  if (edge !== null) {
    return {
      kind: 'edge',
      id: `${edge.getAttribute('data-from') ?? ''}>${edge.getAttribute('data-to') ?? ''}`,
      from: edge.getAttribute('data-from') ?? '',
      to: edge.getAttribute('data-to') ?? ''
    }
  }

  return null
}

function sameSelection(left: Selection | null, right: Selection | null): boolean {
  if (left === null || right === null) {
    return left === null && right === null
  }

  return left.kind === right.kind && left.id === right.id
}

function svgOf(root: HTMLElement): SVGSVGElement | null {
  return root.querySelector('svg')
}

function clearSelection(root: HTMLElement): void {
  root.classList.remove('has-sel')

  const svg = svgOf(root)

  if (svg === null) {
    return
  }

  svg.classList.remove('has-sel')

  eachElement(svg.querySelectorAll('.hot'), (node) => {
    node.classList.remove('hot')
  })
}

function edgeTouches(edge: Element, id: string): boolean {
  return edge.getAttribute('data-from') === id || edge.getAttribute('data-to') === id
}

function applySelection(root: HTMLElement, selection: Selection | null): void {
  const svg = svgOf(root)

  if (svg === null || selection === null) {
    clearSelection(root)

    return
  }

  root.classList.add('has-sel')
  svg.classList.add('has-sel')

  eachElement(svg.querySelectorAll('.hot'), (node) => {
    node.classList.remove('hot')
  })

  if (selection.kind === 'node') {
    eachElement(svg.querySelectorAll('[data-node]'), (node) => {
      const id = node.getAttribute('data-node')

      if (id === selection.id) {
        node.classList.add('hot')
      }
    })

    eachElement(svg.querySelectorAll('[data-edge]'), (edge) => {
      if (edgeTouches(edge, selection.id)) {
        edge.classList.add('hot')

        const other =
          edge.getAttribute('data-from') === selection.id
            ? edge.getAttribute('data-to')
            : edge.getAttribute('data-from')

        if (other !== null) {
          const peer = svg.querySelector(`[data-node="${other}"]`)

          if (peer !== null) {
            peer.classList.add('hot')
          }
        }
      }
    })

    return
  }

  eachElement(svg.querySelectorAll('[data-edge]'), (edge) => {
    if (
      edge.getAttribute('data-from') === selection.from &&
      edge.getAttribute('data-to') === selection.to
    ) {
      edge.classList.add('hot')
    }
  })

  eachElement(svg.querySelectorAll('[data-node]'), (node) => {
    const id = node.getAttribute('data-node')

    if (id === selection.from || id === selection.to) {
      node.classList.add('hot')
    }
  })
}

function focusables(root: HTMLElement): Array<HTMLElement | SVGElement> {
  const out: Array<HTMLElement | SVGElement> = []
  const list = root.querySelectorAll('[data-node], [data-edge]')

  for (let index = 0; index < list.length; index += 1) {
    const node = list.item(index)

    if (
      (node instanceof HTMLElement || node instanceof SVGElement) &&
      node.getAttribute('tabindex') !== null
    ) {
      out.push(node)
    }
  }

  return out
}

export function enhanceDiagram(root: HTMLElement): void {
  let sticky: Selection | null = null

  const hover = (selection: Selection | null): void => {
    if (sticky !== null) {
      applySelection(root, sticky)

      return
    }

    applySelection(root, selection)
  }

  root.addEventListener('pointerover', (event) => {
    hover(closestSelection(event.target))
  })

  root.addEventListener('pointerout', (event) => {
    const from = closestSelection(event.target)

    if (from === null) {
      return
    }

    const related =
      event.relatedTarget instanceof Element ? closestSelection(event.relatedTarget) : null

    if (sameSelection(from, related)) {
      return
    }

    hover(related)
  })

  root.addEventListener('pointerleave', () => {
    hover(null)
  })

  root.addEventListener('click', (event) => {
    const selection = closestSelection(event.target)

    if (selection === null) {
      sticky = null
      applySelection(root, null)

      return
    }

    sticky = sameSelection(sticky, selection) ? null : selection
    applySelection(root, sticky)
  })

  root.addEventListener('focusin', (event) => {
    const selection = closestSelection(event.target)

    if (selection !== null) {
      applySelection(root, selection)
    }
  })

  root.addEventListener('focusout', () => {
    applySelection(root, sticky)
  })

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      sticky = null
      applySelection(root, null)

      return
    }

    const items = focusables(root)

    if (items.length === 0) {
      return
    }

    let next: number | null = null
    const active = document.activeElement

    let current = -1

    for (let index = 0; index < items.length; index += 1) {
      if (items[index] === active) {
        current = index
      }
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = current === -1 ? 0 : Math.min(current + 1, items.length - 1)
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = current === -1 ? items.length - 1 : Math.max(current - 1, 0)
    }

    if (event.key === 'Home') {
      next = 0
    }

    if (event.key === 'End') {
      next = items.length - 1
    }

    if (next === null) {
      return
    }

    event.preventDefault()
    const target = items[next]

    if (target !== undefined) {
      target.focus()
    }
  })
}
