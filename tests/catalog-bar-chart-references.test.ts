import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { renderBarChart } from '../catalog/charts/bar-chart-render.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

/**
 * bar-chart reference lines: a dashed line on the value axis with a mono
 * label, perpendicular to the bars, with the domain expanded to keep it
 * on the plot.
 */

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

function blockFor(json: string): string {
  return `<figure data-aha="bar-chart">\n<script type="application/json">${json}</script>\n</figure>`
}

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function markLine(html: string): { x1: number; y1: number; x2: number; y2: number } | null {
  const match = /<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" class="mark"/.exec(
    html
  )

  if (match === null) {
    return null
  }

  return {
    x1: Number(match[1]),
    y1: Number(match[2]),
    x2: Number(match[3]),
    y2: Number(match[4])
  }
}

describe('bar-chart reference lines', () => {
  it('draws a horizontal line for vertical bars', () => {
    const html = renderBarChart(
      {
        categories: ['a', 'b'],
        series: [{ name: 'S', values: [10, 20] }],
        references: [{ value: 15, label: 'mid' }]
      },
      { width: 640, idPrefix: 'refs-v' }
    )

    const line = markLine(html)

    expect(line).not.toBeNull()

    if (line === null) {
      return
    }

    expect(line.y1).toBe(line.y2)
    expect(line.x2 - line.x1).toBeGreaterThan(400)
    expect(html).toContain('class="mlab"')
    expect(html).toContain('mid')
  })

  it('draws a vertical line for horizontal bars', () => {
    const html = renderBarChart(
      {
        orientation: 'horizontal',
        categories: ['a', 'b'],
        series: [{ name: 'S', values: [10, 20] }],
        references: [{ value: 15, label: 'mid' }]
      },
      { width: 640, idPrefix: 'refs-h' }
    )

    const line = markLine(html)

    expect(line).not.toBeNull()

    if (line === null) {
      return
    }

    expect(line.x1).toBe(line.x2)
    expect(line.y2 - line.y1).toBeGreaterThan(60)
    expect(html).toContain('class="mlab"')
    expect(html).toContain('mid')
  })

  it('expands the domain so a reference above the max stays on the plot', () => {
    const html = renderBarChart(
      {
        categories: ['a', 'b'],
        series: [{ name: 'S', values: [10, 20] }],
        references: [{ value: 42, label: 'limit 42 days' }]
      },
      { width: 640, idPrefix: 'refs-domain' }
    )

    const line = markLine(html)

    expect(line).not.toBeNull()

    if (line === null) {
      return
    }

    expect(line.y1).toBeGreaterThanOrEqual(20)
    expect(line.y1).toBeLessThanOrEqual(340)
    expect(html).toContain('limit 42 days')
    expect(html).toContain('Reference:')
  })

  it('keeps the reference label clear of the value labels', () => {
    const html = renderBarChart(
      {
        title: 'Days abroad per year',
        categories: ['2021', '2022', '2023', '2024', '2025'],
        series: [{ name: 'days', values: [28, 51, 37, 63, 44] }],
        references: [{ value: 42, label: 'limit 42 days' }]
      },
      { width: 640, idPrefix: 'refs-clear' }
    )

    const valueBoxes: Array<{ x0: number; x1: number; y0: number; y1: number }> = []

    const valuePattern =
      /<text x="([\d.]+)" y="([\d.]+)" text-anchor="([a-z]+)" class="vlab">([^<]*)<\/text>/g

    let valueMatch: RegExpExecArray | null = null

    while (true) {
      valueMatch = valuePattern.exec(html)

      if (valueMatch === null) {
        break
      }

      const x = Number(valueMatch[1])
      const y = Number(valueMatch[2])
      const anchor = valueMatch[3] ?? 'middle'
      const text = valueMatch[4] ?? ''
      const half = text.length * 3.5 + 2

      const box =
        anchor === 'middle'
          ? { x0: x - half, x1: x + half, y0: y - 12, y1: y + 4 }
          : { x0: x - half * 2, x1: x, y0: y - 12, y1: y + 4 }

      valueBoxes.push(box)
    }

    expect(valueBoxes.length).toBeGreaterThan(0)

    const labelPattern =
      /<text x="([\d.]+)" y="([\d.]+)" text-anchor="end" class="mlab">([^<]*)<\/text>/g

    let labelMatch: RegExpExecArray | null = null
    let labelCount = 0

    while (true) {
      labelMatch = labelPattern.exec(html)

      if (labelMatch === null) {
        break
      }

      labelCount += 1

      const x = Number(labelMatch[1])
      const y = Number(labelMatch[2])
      const text = labelMatch[3] ?? ''
      const box = { x0: x - text.length * 7, x1: x, y0: y - 12, y1: y + 4 }

      for (const other of valueBoxes) {
        const overlap =
          box.x0 < other.x1 && other.x0 < box.x1 && box.y0 < other.y1 && other.y0 < box.y1

        expect(overlap).toBe(false)
      }
    }

    expect(labelCount).toBe(1)
  })

  it.effect('rejects more than three references with a references path', () =>
    Effect.gen(function* () {
      const bad =
        '{"categories": ["a"], "series": [{"name": "S", "values": [1]}], ' +
        '"references": [{"value": 1}, {"value": 2}, {"value": 3}, {"value": 4}]}'

      const failure = yield* buildPage(authorPage(blockFor(bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('bar-chart')
        expect(failure.path).toContain('references')
      }
    })
  )

  it.effect('reports the references path when a reference misses its value', () =>
    Effect.gen(function* () {
      const bad =
        '{"categories": ["a"], "series": [{"name": "S", "values": [1]}], ' +
        '"references": [{"label": "no value"}]}'

      const failure = yield* buildPage(authorPage(blockFor(bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('bar-chart')
        expect(failure.path).toContain('references')
      }
    })
  )
})
