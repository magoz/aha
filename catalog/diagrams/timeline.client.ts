import { observeContainerWidth } from '../shared/chart-client.js'
import { parseJsonRecord } from '../shared/guards.js'
import { decodeTimelineJson } from './timeline-codec.js'
import { TIMELINE_WIDTH, renderTimeline } from './timeline-render.js'
import type { TimelineInput } from './timeline-schema.js'

/**
 * Timeline browser client. Timelines carry no interaction, but the date
 * axis and bar labels are laid out for the container width, so the
 * client re-renders when the live width differs from the static one
 * (the build defaults to 640px without data-width) and on later
 * resizes. No Effect or Schema here.
 */

function readInput(figure: HTMLElement): TimelineInput | null {
  const script = figure.querySelector('script[type="application/json"]')

  if (script === null) {
    return null
  }

  const record = parseJsonRecord(script.textContent ?? '')

  if (record === null) {
    return null
  }

  return decodeTimelineJson(record)
}

function currentWidth(figure: HTMLElement): number {
  const rect = figure.getBoundingClientRect()

  if (rect.width > 0) {
    return Math.min(900, Math.round(rect.width))
  }

  return TIMELINE_WIDTH
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

  const html = renderTimeline(input, {
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

function initTimelines(): void {
  const figures = document.querySelectorAll('figure[data-aha="timeline"]')

  for (let index = 0; index < figures.length; index += 1) {
    const figure = figures.item(index)

    if (figure instanceof HTMLElement) {
      initFigure(figure)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTimelines)
} else {
  initTimelines()
}
