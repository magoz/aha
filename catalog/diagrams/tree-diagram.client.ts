import { enhanceDiagram } from './diagram-client.js'
import { observeContainerWidth } from '../shared/chart-client.js'
import { parseJsonRecord } from '../shared/guards.js'
import { decodeTreeDiagramJson } from './tree-diagram-codec.js'
import { TREE_DIAGRAM_WIDTH, renderTreeDiagram } from './tree-diagram-render.js'
import type { TreeDiagramInput } from './tree-diagram-schema.js'

/**
 * Tree-diagram browser client. Collapsible subtrees (fully expanded
 * without scripts), container reflow between tree and list layouts, and
 * hover, focus, tap and keyboard selection. No Effect or Schema here.
 */

const collapsedByFigure = new WeakMap<HTMLElement, Array<string>>()

function collapsedFor(figure: HTMLElement): Array<string> {
  const found = collapsedByFigure.get(figure)

  if (found !== undefined) {
    return found
  }

  const fresh: Array<string> = []
  collapsedByFigure.set(figure, fresh)

  return fresh
}

function setSubDisplay(svg: SVGSVGElement, path: string, hidden: boolean): void {
  const subs = svg.querySelectorAll('[data-sub]')

  for (let index = 0; index < subs.length; index += 1) {
    const sub = subs.item(index)

    if (sub instanceof SVGGElement && sub.getAttribute('data-sub') === path) {
      sub.style.display = hidden ? 'none' : ''
    }
  }
}

function setToggleMark(svg: SVGSVGElement, path: string, collapsed: boolean): void {
  const nodes = svg.querySelectorAll('[data-kids]')

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index)

    if (!(node instanceof Element) || node.getAttribute('data-kids') !== path) {
      continue
    }

    node.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    const mark = node.querySelector('.tglx')

    if (mark !== null) {
      mark.textContent = collapsed ? '+' : '−'
    }
  }
}

function applyCollapsed(figure: HTMLElement): void {
  const root = figure.querySelector('.aha-diagram svg')

  if (!(root instanceof SVGSVGElement)) {
    return
  }

  const subs = root.querySelectorAll('[data-sub]')

  for (let index = 0; index < subs.length; index += 1) {
    const sub = subs.item(index)

    if (sub instanceof SVGGElement) {
      sub.style.display = ''
    }
  }

  const toggles = root.querySelectorAll('[data-kids]')

  for (let index = 0; index < toggles.length; index += 1) {
    const node = toggles.item(index)

    if (node instanceof Element) {
      node.setAttribute('aria-expanded', 'true')
      const mark = node.querySelector('.tglx')

      if (mark !== null) {
        mark.textContent = '−'
      }
    }
  }

  for (const path of collapsedFor(figure)) {
    setSubDisplay(root, path, true)
    setToggleMark(root, path, true)
  }
}

function togglePath(figure: HTMLElement, path: string): void {
  const collapsed = collapsedFor(figure)
  let found = -1

  for (let index = 0; index < collapsed.length; index += 1) {
    if (collapsed[index] === path) {
      found = index
    }
  }

  if (found === -1) {
    collapsed.push(path)
  } else {
    collapsed.splice(found, 1)
  }

  applyCollapsed(figure)
}

function readInput(figure: HTMLElement): TreeDiagramInput | null {
  const script = figure.querySelector('script[type="application/json"]')

  if (script === null) {
    return null
  }

  const record = parseJsonRecord(script.textContent ?? '')

  if (record === null) {
    return null
  }

  return decodeTreeDiagramJson(record)
}

function currentWidth(figure: HTMLElement): number {
  const rect = figure.getBoundingClientRect()

  if (rect.width > 0) {
    return Math.min(900, Math.round(rect.width))
  }

  return TREE_DIAGRAM_WIDTH
}

function rerender(figure: HTMLElement): void {
  const root = figure.querySelector('.aha-diagram')

  if (root === null) {
    return
  }

  const input = readInput(figure)

  if (input === null) {
    return
  }

  const html = renderTreeDiagram(input, {
    width: currentWidth(figure),
    idPrefix: root.getAttribute('data-diagram-id') ?? 'diagram'
  })

  const template = document.createElement('template')
  template.innerHTML = html
  const next = template.content.firstElementChild

  if (next === null) {
    return
  }

  const nextSvg = next.querySelector('svg')
  const oldSvg = root.querySelector('svg')

  if (nextSvg !== null && oldSvg !== null) {
    oldSvg.replaceWith(nextSvg)
    applyCollapsed(figure)
  }
}

function kidsFromEvent(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null
  }

  const node = target.closest('[data-kids]')

  if (node === null) {
    return null
  }

  return node.getAttribute('data-kids')
}

function initFigure(figure: HTMLElement): void {
  const root = figure.querySelector('.aha-diagram')

  if (!(root instanceof HTMLElement)) {
    return
  }

  enhanceDiagram(root)

  const svg = root.querySelector('svg')
  const layout = currentWidth(figure) < 560 ? 'narrow' : 'wide'

  if ((svg?.getAttribute('data-layout') ?? 'wide') !== layout) {
    rerender(figure)
  }

  root.addEventListener('click', (event) => {
    const path = kidsFromEvent(event.target)

    if (path !== null) {
      togglePath(figure, path)
    }
  })

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const path = kidsFromEvent(event.target)

    if (path === null) {
      return
    }

    event.preventDefault()
    togglePath(figure, path)
  })

  let frame = 0
  let lastWidth = Math.round(root.getBoundingClientRect().width)

  observeContainerWidth(root, (width) => {
    if (width === 0 || Math.abs(width - lastWidth) < 24) {
      return
    }

    lastWidth = width

    if (frame !== 0) {
      window.cancelAnimationFrame(frame)
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0
      rerender(figure)
    })
  })
}

function initTreeDiagrams(): void {
  const figures = document.querySelectorAll('figure[data-aha="tree-diagram"]')

  for (let index = 0; index < figures.length; index += 1) {
    const figure = figures.item(index)

    if (figure instanceof HTMLElement) {
      initFigure(figure)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTreeDiagrams)
} else {
  initTreeDiagrams()
}
