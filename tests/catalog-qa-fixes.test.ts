import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { groupBounds, layoutGraph } from '../catalog/diagrams/layout.js'
import { flowDiagramComponent } from '../catalog/diagrams/flow-diagram.js'
import { renderSequenceDiagram } from '../catalog/diagrams/sequence-diagram-render.js'
import { sequenceDiagramComponent } from '../catalog/diagrams/sequence-diagram.js'
import { stateDiagramComponent } from '../catalog/diagrams/state-diagram.js'
import { renderDataTable } from '../catalog/data/data-table-render.js'
import { renderLineChart } from '../catalog/charts/line-chart-render.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function jsonFigure(name: string, json: string): string {
  return `<figure data-aha="${name}">\n<script type="application/json">${json}</script>\n</figure>`
}

interface Rect {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

function rectsOverlap(left: Rect, right: Rect): boolean {
  return left.x0 < right.x1 && right.x0 < left.x1 && left.y0 < right.y1 && right.y0 < left.y1
}

function labelRect(x: number, y: number, label: string): Rect {
  const w = label.length * 6.4 + 12

  return { x0: x - w / 2, y0: y - 11, x1: x + w / 2, y1: y + 3 }
}

function viewBoxWidth(svg: string): number {
  const match = /viewBox="([^"]+)"/.exec(svg)

  if (match === null) {
    return 0
  }

  const head = match[1] ?? ''

  const parts = head.split(' ')

  const width = Number(parts[2] ?? '0')

  return Number.isFinite(width) ? width : 0
}

describe('visual QA fixes', () => {
  it('keeps flow example groups disjoint with shared nodes ungrouped', () => {
    const example = flowDiagramComponent.examples[0]?.json ?? '{}'

    const parsed = JSON.parse(example)

    const seen = new Map<string, string>()

    for (const node of parsed.nodes) {
      if (node.group !== undefined) {
        expect(seen.has(node.id)).toBe(false)

        seen.set(node.id, node.group)
      }
    }

    let apiGroup: string | undefined

    let r2Group: string | undefined

    for (const node of parsed.nodes) {
      if (node.id === 'api') {
        apiGroup = node.group
      }

      if (node.id === 'r2') {
        r2Group = node.group
      }
    }

    expect(apiGroup).toBe(undefined)

    expect(r2Group).toBe(undefined)
  })

  it('lays flow groups out without overlapping frames or members', () => {
    const example = flowDiagramComponent.examples[0]?.json ?? '{}'

    const parsed = JSON.parse(example)

    const groupIds: Array<string> = []

    for (const group of parsed.groups) {
      groupIds.push(group.id)
    }

    for (const width of [720, 390]) {
      const direction = width < 560 ? 'tb' : 'lr'

      const layout = layoutGraph(parsed.nodes, parsed.edges, {
        direction,
        span: width,
        groupOrder: groupIds
      })

      const frames: Array<Rect> = []

      for (const group of parsed.groups) {
        const members: Array<string> = []

        for (const node of parsed.nodes) {
          if (node.group === group.id) {
            members.push(node.id)
          }
        }

        const bounds = groupBounds(layout.boxes, members)

        expect(bounds).not.toBe(null)

        if (bounds !== null) {
          frames.push({
            x0: bounds.x,
            y0: bounds.y,
            x1: bounds.x + bounds.w,
            y1: bounds.y + bounds.h
          })

          for (const box of layout.boxes) {
            let member = false

            for (const id of members) {
              if (id === box.id) {
                member = true
              }
            }

            if (!member) {
              const boxRect: Rect = {
                x0: box.x,
                y0: box.y,
                x1: box.x + box.w,
                y1: box.y + box.h
              }

              const frame: Rect = {
                x0: bounds.x,
                y0: bounds.y,
                x1: bounds.x + bounds.w,
                y1: bounds.y + bounds.h
              }

              expect(rectsOverlap(boxRect, frame)).toBe(false)
            }
          }
        }
      }

      for (let outer = 0; outer < frames.length; outer += 1) {
        for (let inner = outer + 1; inner < frames.length; inner += 1) {
          const left = frames[outer]

          const right = frames[inner]

          if (left !== undefined && right !== undefined) {
            expect(rectsOverlap(left, right)).toBe(false)
          }
        }
      }
    }
  })

  it('places flow edge labels without collisions', () => {
    const example = flowDiagramComponent.examples[0]?.json ?? '{}'

    const parsed = JSON.parse(example)

    const groupIds: Array<string> = []

    for (const group of parsed.groups) {
      groupIds.push(group.id)
    }

    const layout = layoutGraph(parsed.nodes, parsed.edges, {
      direction: 'lr',
      span: 720,
      groupOrder: groupIds
    })

    const placed: Array<Rect> = []

    for (const edge of layout.edges) {
      if (edge.label === null) {
        continue
      }

      const rect = labelRect(edge.labelX, edge.labelY, edge.label)

      for (const box of layout.boxes) {
        const expanded: Rect = {
          x0: box.x - 5,
          y0: box.y - 5,
          x1: box.x + box.w + 5,
          y1: box.y + box.h + 5
        }

        expect(rectsOverlap(rect, expanded)).toBe(false)
      }

      for (const other of placed) {
        expect(rectsOverlap(rect, other)).toBe(false)
      }

      placed.push(rect)
    }
  })

  it.effect('rejects overlapping flow group membership with a clear error', () =>
    Effect.gen(function* () {
      const bad =
        '{"groups": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}], ' +
        '"nodes": [{"id": "x", "label": "X", "groups": ["a", "b"]}], "edges": []}'

      const failure = yield* buildPage(authorPage(jsonFigure('flow-diagram', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toBe('nodes')

        expect(failure.detail).toContain('at most one group')
      }
    })
  )

  it('fits three sequence actors at 390px without scrolling', () => {
    const example = sequenceDiagramComponent.examples[0]?.json ?? '{}'

    const html = renderSequenceDiagram(JSON.parse(example), { width: 390, idPrefix: 'qa' })

    expect(html).not.toContain('min-width')

    expect(html).toContain('Vercel API')
  })

  it.effect('renders nested charts at the parent width in every pane', () =>
    Effect.gen(function* () {
      const chart =
        '{"title": "Balance", "x": {"kind": "category"}, ' +
        '"series": [{"name": "balance", "values": [{"x": "a", "y": 1}]}]}'

      for (const width of [720, 390]) {
        const source = authorPage(
          `<div data-aha="scenarios" data-width="${String(width)}">\n` +
            '<section data-scenario="one"><figure data-aha="line-chart">\n' +
            `<script type="application/json">${chart}</script>\n</figure></section>\n</div>`
        )

        const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

        const svgAt = html.indexOf('<svg viewBox="0 0 ')

        const svg = html.slice(svgAt, svgAt + 80)

        expect(viewBoxWidth(svg)).toBe(width)
      }
    })
  )

  it('renders the nested chart viewBox at its container width', () => {
    const chart = JSON.parse(
      '{"title": "Balance", "x": {"kind": "category"}, ' +
        '"series": [{"name": "balance", "values": [{"x": "a", "y": 1}]}]}'
    )

    const html = renderLineChart(chart, { width: 390, idPrefix: 'qa' })

    expect(viewBoxWidth(html)).toBe(390)
  })

  it('keeps the data-table title outside the bordered wrapper', () => {
    const input = JSON.parse(
      '{"title": "Model cost per 1k tasks", ' +
        '"columns": [{"key": "model", "label": "model", "type": "text"}], ' +
        '"rows": [["Arbor"]]}'
    )

    const html = renderDataTable(input, { idPrefix: 'qa' })

    const titleAt = html.indexOf('<p class="aha-title">')

    const wrapAt = html.indexOf('<div class="tw">')

    expect(titleAt).toBeGreaterThanOrEqual(0)

    expect(wrapAt).toBeGreaterThan(titleAt)
  })

  it('places state self-loop labels without collisions at 390px', () => {
    const example = stateDiagramComponent.examples[0]?.json ?? '{}'

    const parsed = JSON.parse(example)

    const layout = layoutGraph(parsed.states, parsed.transitions, { direction: 'tb', span: 390 })

    const placed: Array<Rect> = []

    for (const edge of layout.edges) {
      if (edge.label === null) {
        continue
      }

      const rect = labelRect(edge.labelX, edge.labelY, edge.label)

      for (const other of placed) {
        expect(rectsOverlap(rect, other)).toBe(false)
      }

      placed.push(rect)
    }

    let upload: Rect | null = null

    let update: Rect | null = null

    for (const edge of layout.edges) {
      if (edge.label === 'upload') {
        upload = labelRect(edge.labelX, edge.labelY, edge.label)
      }

      if (edge.label === 'update') {
        update = labelRect(edge.labelX, edge.labelY, edge.label)
      }
    }

    expect(upload).not.toBe(null)

    expect(update).not.toBe(null)

    if (upload !== null && update !== null) {
      expect(rectsOverlap(upload, update)).toBe(false)
    }
  })
})
