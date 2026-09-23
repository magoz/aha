import { enhanceDiagram } from './diagram-client.js'
import { observeContainerWidth } from '../shared/chart-client.js'
import { parseJsonRecord } from '../shared/guards.js'
import { decodeSequenceDiagramJson } from './sequence-diagram-codec.js'
import { SEQUENCE_DIAGRAM_WIDTH, renderSequenceDiagram } from './sequence-diagram-render.js'
import type { SequenceDiagramInput } from './sequence-diagram-schema.js'

/**
 * Sequence-diagram browser client. Re-renders lanes on container resize
 * and wires hover, focus, tap and keyboard selection through the shared
 * helper. No Effect or Schema here.
 */

function readInput(figure: HTMLElement): SequenceDiagramInput | null {
  const script = figure.querySelector('script[type="application/json"]')

  if (script === null) {
    return null
  }

  const record = parseJsonRecord(script.textContent ?? '')

  if (record === null) {
    return null
  }

  return decodeSequenceDiagramJson(record)
}

function currentWidth(figure: HTMLElement): number {
  const rect = figure.getBoundingClientRect()

  if (rect.width > 0) {
    return Math.min(900, Math.round(rect.width))
  }

  return SEQUENCE_DIAGRAM_WIDTH
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

  const html = renderSequenceDiagram(input, {
    width: currentWidth(figure),
    idPrefix: root.getAttribute('data-diagram-id') ?? 'diagram'
  })

  const template = document.createElement('template')
  template.innerHTML = html
  const next = template.content.firstElementChild

  if (next === null) {
    return
  }

  const nextWrap = next.querySelector('.swrap')
  const oldWrap = root.querySelector('.swrap')

  if (nextWrap !== null && oldWrap !== null) {
    oldWrap.replaceWith(nextWrap)
  }

  const nextDetails = next.querySelector('details')
  const oldDetails = root.querySelector('details')

  if (nextDetails !== null && oldDetails !== null) {
    oldDetails.replaceWith(nextDetails)
  }
}

function initFigure(figure: HTMLElement): void {
  const root = figure.querySelector('.aha-diagram')

  if (!(root instanceof HTMLElement)) {
    return
  }

  enhanceDiagram(root)

  const svg = root.querySelector('svg')
  const rendered = Number(svg?.getAttribute('data-span') ?? '0')

  if (Number.isNaN(rendered) || Math.abs(rendered - currentWidth(figure)) >= 24) {
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

function initSequenceDiagrams(): void {
  const figures = document.querySelectorAll('figure[data-aha="sequence-diagram"]')

  for (let index = 0; index < figures.length; index += 1) {
    const figure = figures.item(index)

    if (figure instanceof HTMLElement) {
      initFigure(figure)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSequenceDiagrams)
} else {
  initSequenceDiagrams()
}
