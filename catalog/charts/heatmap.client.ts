import { enhanceChart, observeContainerWidth } from '../shared/chart-client.js'
import type { ChartStop } from '../shared/chart-client.js'
import { parseJsonRecord } from '../shared/guards.js'
import { decodeHeatmapJson } from './heatmap-codec.js'
import { HEATMAP_WIDTH, heatmapStops, renderHeatmap } from './heatmap-render.js'
import type { HeatmapInput } from './heatmap-schema.js'

/**
 * Heatmap browser client. Compact IIFE entry built by the repo build;
 * `aha build` inlines the bundle. No Effect or Schema here: the JSON was
 * validated at build time and is read defensively.
 */

function readInput(figure: HTMLElement): HeatmapInput | null {
  const script = figure.querySelector('script[type="application/json"]')

  if (script === null) {
    return null
  }

  const record = parseJsonRecord(script.textContent ?? '')

  if (record === null) {
    return null
  }

  return decodeHeatmapJson(record)
}

function currentWidth(figure: HTMLElement): number {
  const rect = figure.getBoundingClientRect()

  if (rect.width > 0) {
    return Math.min(900, Math.round(rect.width))
  }

  return HEATMAP_WIDTH
}

function stopsFor(figure: HTMLElement): ReadonlyArray<ChartStop> {
  const input = readInput(figure)

  if (input === null) {
    return []
  }

  return heatmapStops(input, currentWidth(figure))
}

function rerender(figure: HTMLElement): void {
  const chart = figure.querySelector('.aha-chart')

  if (chart === null) {
    return
  }

  const input = readInput(figure)

  if (input === null) {
    return
  }

  const html = renderHeatmap(input, {
    width: currentWidth(figure),
    idPrefix: chart.getAttribute('data-chart-id') ?? 'chart'
  })

  const template = document.createElement('template')
  template.innerHTML = html
  const next = template.content.firstElementChild

  if (next === null) {
    return
  }

  const nextSvg = next.querySelector('svg')
  const oldSvg = chart.querySelector('svg')

  if (nextSvg !== null && oldSvg !== null) {
    oldSvg.replaceWith(nextSvg)
  }

  const nextDetails = next.querySelector('details')
  const oldDetails = chart.querySelector('details')

  if (nextDetails !== null && oldDetails !== null) {
    oldDetails.replaceWith(nextDetails)
  }
}

function initFigure(figure: HTMLElement): void {
  const chart = figure.querySelector('.aha-chart')

  if (!(chart instanceof HTMLElement)) {
    return
  }

  const tip = chart.querySelector('.aha-tip')

  if (!(tip instanceof HTMLElement)) {
    return
  }

  enhanceChart({
    root: chart,
    focusable: chart,
    tip,
    getSvg: () => chart.querySelector('svg'),
    getStops: () => stopsFor(figure)
  })

  let frame = 0
  let lastWidth = Math.round(chart.getBoundingClientRect().width)

  observeContainerWidth(chart, (width) => {
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

function initHeatmaps(): void {
  const figures = document.querySelectorAll('figure[data-aha="heatmap"]')

  for (let index = 0; index < figures.length; index += 1) {
    const figure = figures.item(index)

    if (figure instanceof HTMLElement) {
      initFigure(figure)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeatmaps)
} else {
  initHeatmaps()
}
