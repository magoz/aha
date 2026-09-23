import { enhanceDiagram } from './diagram-client.js'
import { directionFor } from './layout.js'
import { observeContainerWidth } from '../shared/chart-client.js'
import { parseJsonRecord } from '../shared/guards.js'
import { decodeStateDiagramJson } from './state-diagram-codec.js'
import { STATE_DIAGRAM_WIDTH, renderStateDiagram } from './state-diagram-render.js'
import type { StateDiagramInput } from './state-diagram-schema.js'

/**
 * State-diagram browser client. Re-renders the SVG on container resize
 * so the layout reflows, and wires hover, focus, tap and keyboard
 * selection through the shared helper. No Effect or Schema here.
 */

function readInput(figure: HTMLElement): StateDiagramInput | null {
  const script = figure.querySelector('script[type="application/json"]')

  if (script === null) {
    return null
  }

  const record = parseJsonRecord(script.textContent ?? '')

  if (record === null) {
    return null
  }

  return decodeStateDiagramJson(record)
}

function currentWidth(figure: HTMLElement): number {
  const rect = figure.getBoundingClientRect()

  if (rect.width > 0) {
    return Math.min(900, Math.round(rect.width))
  }

  return STATE_DIAGRAM_WIDTH
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

  const html = renderStateDiagram(input, {
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
  }
}

function initFigure(figure: HTMLElement): void {
  const root = figure.querySelector('.aha-diagram')

  if (!(root instanceof HTMLElement)) {
    return
  }

  enhanceDiagram(root)

  const svg = root.querySelector('svg')

  if (svg?.getAttribute('data-direction') !== directionFor(undefined, currentWidth(figure))) {
    rerender(figure)
  }

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

function initStateDiagrams(): void {
  const figures = document.querySelectorAll('figure[data-aha="state-diagram"]')

  for (let index = 0; index < figures.length; index += 1) {
    const figure = figures.item(index)

    if (figure instanceof HTMLElement) {
      initFigure(figure)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStateDiagrams)
} else {
  initStateDiagrams()
}
