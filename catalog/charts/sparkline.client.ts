import { enhanceChart } from '../shared/chart-client.js'
import type { ChartStop } from '../shared/chart-client.js'
import { parseJsonRecord } from '../shared/guards.js'
import { decodeSparklineJson } from './sparkline-codec.js'
import { sparklineStops } from './sparkline-render.js'
import type { SparklineInput } from './sparkline-schema.js'

/**
 * Sparkline browser client. The spark scales with CSS from its fixed
 * viewBox, so this entry only adds hover values through the shared kit and
 * never re-renders. No Effect or Schema here.
 */

function readInput(block: HTMLElement): SparklineInput | null {
  const script = block.querySelector('script[type="application/json"]')

  if (script === null) {
    return null
  }

  const record = parseJsonRecord(script.textContent ?? '')

  if (record === null) {
    return null
  }

  return decodeSparklineJson(record)
}

function stopsFor(block: HTMLElement): ReadonlyArray<ChartStop> {
  const input = readInput(block)

  if (input === null) {
    return []
  }

  return sparklineStops(input)
}

function initSpark(block: HTMLElement): void {
  const spark = block.querySelector('.aha-spark')

  if (!(spark instanceof HTMLElement)) {
    return
  }

  const tip = spark.querySelector('.aha-tip')

  if (!(tip instanceof HTMLElement)) {
    return
  }

  enhanceChart({
    root: spark,
    focusable: spark,
    tip,
    getSvg: () => spark.querySelector('svg'),
    getStops: () => stopsFor(block)
  })
}

function initSparklines(): void {
  const blocks = document.querySelectorAll(
    'figure[data-aha="sparkline"], div[data-aha="sparkline"]'
  )

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks.item(index)

    if (block instanceof HTMLElement) {
      initSpark(block)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSparklines)
} else {
  initSparklines()
}
