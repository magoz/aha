import { enhanceDiagram } from './diagram-client.js'
import { directionFor } from './layout.js'
import { observeContainerWidth } from '../shared/chart-client.js'
import { parseJsonRecord } from '../shared/guards.js'
import { decodeFlowDiagramJson } from './flow-diagram-codec.js'
import { FLOW_DIAGRAM_WIDTH, renderFlowDiagram } from './flow-diagram-render.js'
import type { FlowDiagramInput } from './flow-diagram-schema.js'

/**
 * Flow-diagram browser client. Re-renders the SVG on container resize so
 * the layout reflows between left-to-right and top-to-bottom, and wires
 * hover, focus, tap and keyboard selection through the shared helper.
 * No Effect or Schema here.
 */

function readInput(figure: HTMLElement): FlowDiagramInput | null {
  const script = figure.querySelector('script[type="application/json"]')

  if (script === null) {
    return null
  }

  const record = parseJsonRecord(script.textContent ?? '')

  if (record === null) {
    return null
  }

  return decodeFlowDiagramJson(record)
}

function currentWidth(figure: HTMLElement): number {
  const rect = figure.getBoundingClientRect()

  if (rect.width > 0) {
    return Math.min(900, Math.round(rect.width))
  }

  return FLOW_DIAGRAM_WIDTH
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

  const html = renderFlowDiagram(input, {
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

  const input = readInput(figure)

  if (input !== null) {
    const svg = root.querySelector('svg')

    if (
      svg?.getAttribute('data-direction') !== directionFor(input.direction, currentWidth(figure))
    ) {
      rerender(figure)
    }
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

function initFlowDiagrams(): void {
  const figures = document.querySelectorAll('figure[data-aha="flow-diagram"]')

  for (let index = 0; index < figures.length; index += 1) {
    const figure = figures.item(index)

    if (figure instanceof HTMLElement) {
      initFigure(figure)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFlowDiagrams)
} else {
  initFlowDiagrams()
}
