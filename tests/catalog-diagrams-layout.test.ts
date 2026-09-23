import { describe, expect, it } from '@effect/vitest'

import {
  directionFor,
  edgeOnPath,
  groupBounds,
  layoutGraph,
  measureLabel,
  nodeHighlighted,
  parseDiagramDate,
  wrapLabel
} from '../catalog/diagrams/layout.js'
import type { LayoutEdgeInput, LayoutNodeInput, PlacedBox } from '../catalog/diagrams/layout.js'

const FLOW_NODES: ReadonlyArray<LayoutNodeInput> = [
  { id: 'agent', label: 'Agent' },
  { id: 'cli', label: 'CLI' },
  { id: 'api', label: 'Vercel API' },
  { id: 'r2', label: 'R2 store' },
  { id: 'reader', label: 'Reader' },
  { id: 'dns', label: 'Public DNS' },
  { id: 'check', label: 'Marker check' },
  { id: 'page', label: 'Served page' },
  { id: 'gateway', label: 'Tailnet gateway' }
]

const FLOW_EDGES: ReadonlyArray<LayoutEdgeInput> = [
  { from: 'agent', to: 'cli', label: 'writes html' },
  { from: 'cli', to: 'api', label: 'upload' },
  { from: 'api', to: 'r2', label: 'put' },
  { from: 'reader', to: 'dns', label: 'resolve' },
  { from: 'dns', to: 'api', label: 'GET' },
  { from: 'api', to: 'check', label: 'marker?' },
  { from: 'check', to: 'page', label: 'serve' },
  { from: 'reader', to: 'gateway', label: 'tailnet' },
  { from: 'gateway', to: 'r2', label: 'read' },
  { from: 'gateway', to: 'page', label: 'serve' }
]

function overlaps(left: PlacedBox, right: PlacedBox): boolean {
  return (
    left.x < right.x + right.w &&
    right.x < left.x + left.w &&
    left.y < right.y + right.h &&
    right.y < left.y + left.h
  )
}

function expectNoOverlaps(boxes: ReadonlyArray<PlacedBox>): void {
  for (let outer = 0; outer < boxes.length; outer += 1) {
    for (let inner = outer + 1; inner < boxes.length; inner += 1) {
      const left = boxes[outer]
      const right = boxes[inner]

      if (left !== undefined && right !== undefined) {
        expect(overlaps(left, right)).toBe(false)
      }
    }
  }
}

describe('diagram layout', () => {
  it('lays out deterministically for the same input', () => {
    const left = layoutGraph(FLOW_NODES, FLOW_EDGES, { direction: 'lr', span: 720 })
    const right = layoutGraph(FLOW_NODES, FLOW_EDGES, { direction: 'lr', span: 720 })

    expect(JSON.stringify(right)).toBe(JSON.stringify(left))
  })

  it('keeps boxes disjoint in both directions', () => {
    const wide = layoutGraph(FLOW_NODES, FLOW_EDGES, { direction: 'lr', span: 720 })
    const narrow = layoutGraph(FLOW_NODES, FLOW_EDGES, { direction: 'tb', span: 390 })

    expectNoOverlaps(wide.boxes)
    expectNoOverlaps(narrow.boxes)
    expect(wide.width).toBeGreaterThanOrEqual(720)
    expect(narrow.width).toBe(390)
  })

  it('layers forward DAG edges strictly left to right', () => {
    const layout = layoutGraph(FLOW_NODES, FLOW_EDGES, { direction: 'lr', span: 720 })
    const byId = new Map<string, PlacedBox>()

    for (const box of layout.boxes) {
      byId.set(box.id, box)
    }

    for (const edge of FLOW_EDGES) {
      const from = byId.get(edge.from)
      const to = byId.get(edge.to)

      if (from !== undefined && to !== undefined) {
        expect(to.layer).toBeGreaterThan(from.layer)
      }
    }
  })

  it('routes back edges on lanes below without overlapping boxes', () => {
    const nodes: ReadonlyArray<LayoutNodeInput> = [
      { id: 'a', label: 'Draft' },
      { id: 'b', label: 'Private' },
      { id: 'c', label: 'Public' }
    ]

    const edges: ReadonlyArray<LayoutEdgeInput> = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'b', label: 'unpublish' }
    ]

    const layout = layoutGraph(nodes, edges, { direction: 'lr', span: 720 })

    expectNoOverlaps(layout.boxes)

    let back = 0

    for (const edge of layout.edges) {
      if (edge.back) {
        back += 1
      }
    }

    expect(back).toBe(1)
    expect(JSON.stringify(layoutGraph(nodes, edges, { direction: 'lr', span: 720 }))).toBe(
      JSON.stringify(layout)
    )
  })

  it('terminates on cycles and skips unknown endpoints', () => {
    const nodes: ReadonlyArray<LayoutNodeInput> = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' }
    ]

    const edges: ReadonlyArray<LayoutEdgeInput> = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
      { from: 'a', to: 'ghost' }
    ]

    const layout = layoutGraph(nodes, edges, { direction: 'lr', span: 720 })

    expect(layout.boxes.length).toBe(2)
    expect(layout.edges.length).toBe(2)
    expectNoOverlaps(layout.boxes)
  })

  it('contains group members inside their bounds', () => {
    const layout = layoutGraph(FLOW_NODES, FLOW_EDGES, { direction: 'lr', span: 720 })
    const bounds = groupBounds(layout.boxes, ['agent', 'cli', 'api', 'r2'])

    expect(bounds).not.toBe(null)

    if (bounds !== null) {
      for (const id of ['agent', 'cli', 'api', 'r2']) {
        const box = layout.boxes.find((entry) => entry.id === id)

        expect(box).not.toBe(undefined)

        if (box !== undefined) {
          expect(box.x).toBeGreaterThanOrEqual(bounds.x)
          expect(box.y).toBeGreaterThanOrEqual(bounds.y)
          expect(box.x + box.w).toBeLessThanOrEqual(bounds.x + bounds.w)
          expect(box.y + box.h).toBeLessThanOrEqual(bounds.y + bounds.h)
        }
      }

      expect(groupBounds(layout.boxes, [])).toBe(null)
    }
  })

  it('picks direction automatically around 560px', () => {
    expect(directionFor('auto', 720)).toBe('lr')
    expect(directionFor('auto', 390)).toBe('tb')
    expect(directionFor(undefined, 390)).toBe('tb')
    expect(directionFor('lr', 390)).toBe('lr')
    expect(directionFor('tb', 720)).toBe('tb')
  })

  it('wraps labels to two lines and measures wide boxes larger', () => {
    const lines = wrapLabel('a fairly long label for a small box here', 12)

    expect(lines.length).toBeLessThanOrEqual(2)
    expect(wrapLabel('short', 12)).toEqual(['short'])

    const small = measureLabel('CLI')
    const big = measureLabel('Tailnet gateway')

    expect(big.w).toBeGreaterThan(small.w)
  })

  it('matches highlight paths and members', () => {
    expect(edgeOnPath('a', 'b', ['a', 'b', 'c'])).toBe(true)
    expect(edgeOnPath('a', 'c', ['a', 'b', 'c'])).toBe(false)
    expect(nodeHighlighted('b', ['a', 'b'])).toBe(true)
    expect(nodeHighlighted('z', ['a', 'b'])).toBe(false)
  })

  it('parses ISO dates and epoch millis, rejecting garbage', () => {
    expect(parseDiagramDate('2026-09-23')).toBe(Date.parse('2026-09-23'))
    expect(parseDiagramDate(1_758_000_000_000)).toBe(1_758_000_000_000)
    expect(parseDiagramDate('not a date')).toBe(null)
    expect(parseDiagramDate(Number.NaN)).toBe(null)
  })
})
