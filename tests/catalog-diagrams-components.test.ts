import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { findCatalogComponent } from '../catalog/categories.js'
import { diagramsComponents } from '../catalog/diagrams/registry.js'
import { flowDiagramComponent } from '../catalog/diagrams/flow-diagram.js'
import { sequenceDiagramComponent } from '../catalog/diagrams/sequence-diagram.js'
import { treeDiagramComponent } from '../catalog/diagrams/tree-diagram.js'
import { timelineComponent } from '../catalog/diagrams/timeline.js'
import { stateDiagramComponent } from '../catalog/diagrams/state-diagram.js'
import { renderFlowDiagram } from '../catalog/diagrams/flow-diagram-render.js'
import { renderTimeline } from '../catalog/diagrams/timeline-render.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n<p>prologue</p>\n${body}\n<p>epilogue</p>\n</body></html>`
}

function jsonFigure(name: string, json: string): string {
  return `<figure data-aha="${name}">\n<script type="application/json">${json}</script>\n<figcaption>Cap.</figcaption>\n</figure>`
}

interface ChainNode {
  readonly label: string
  readonly children?: ReadonlyArray<ChainNode>
}

describe('diagrams registry', () => {
  it('registers five components with unique names and examples', () => {
    expect(diagramsComponents.length).toBe(5)

    const names: Array<string> = []

    for (const component of diagramsComponents) {
      names.push(component.name)
      expect(component.examples.length).toBeGreaterThan(0)
      expect(findCatalogComponent(component.name)).toBe(component)
    }

    expect(names).toEqual([
      'flow-diagram',
      'sequence-diagram',
      'tree-diagram',
      'timeline',
      'state-diagram'
    ])
  })

  it('documents fields plus a paste-ready example for every diagram', () => {
    for (const component of diagramsComponents) {
      const detail = formatComponentDetail(component.name, false)

      expect(detail).not.toBe(null)

      if (detail !== null) {
        expect(detail).toContain(`<figure data-aha="${component.name}">`)
      }
    }

    const flow = formatComponentDetail('flow-diagram', false)

    expect(flow).not.toBe(null)

    if (flow !== null) {
      expect(flow).toContain('nodes')
      expect(flow).toContain('highlight')
    }
  })
})

describe('diagrams build', () => {
  it.effect('renders every diagram example and preserves surrounding bytes', () =>
    Effect.gen(function* () {
      const components = [
        flowDiagramComponent,
        sequenceDiagramComponent,
        treeDiagramComponent,
        timelineComponent,
        stateDiagramComponent
      ]

      for (const component of components) {
        const example = component.examples[0]

        expect(example).not.toBe(undefined)

        if (example?.json === null || example?.json === undefined) {
          continue
        }

        const source = authorPage(jsonFigure(component.name, example.json))
        const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

        expect(html).toContain('<p>prologue</p>')
        expect(html).toContain('<p>epilogue</p>')
        expect(html).toContain(example.json)
        expect(html).toContain('figcaption')

        const rebuilt = yield* buildPage(html).pipe(Effect.provide(stubBundles))

        expect(rebuilt).toBe(html)
      }
    })
  )

  it.effect('inlines only the used diagram bundles', () =>
    Effect.gen(function* () {
      const example = flowDiagramComponent.examples[0]?.json ?? '{}'
      const source = authorPage(jsonFigure('flow-diagram', example))
      const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

      expect(html).toContain('/* bundle:flow-diagram.client.js */')
      expect(html).not.toContain('sequence-diagram.client.js')
      expect(html).not.toContain('tree-diagram.client.js')
    })
  )

  it.effect('rejects flow edges pointing at unknown nodes', () =>
    Effect.gen(function* () {
      const bad = `{"nodes": [{"id": "a", "label": "A"}], "edges": [{"from": "a", "to": "ghost"}]}`

      const failure = yield* buildPage(authorPage(jsonFigure('flow-diagram', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('flow-diagram')
        expect(failure.path).toContain('edges')
      }
    })
  )

  it.effect('rejects duplicate flow node ids and empty graphs', () =>
    Effect.gen(function* () {
      const dup = `{"nodes": [{"id": "a", "label": "A"}, {"id": "a", "label": "B"}], "edges": []}`

      const dupFailure = yield* buildPage(authorPage(jsonFigure('flow-diagram', dup))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(dupFailure, 'BlockDecodeError')).toBe(true)

      const empty = `{"nodes": [], "edges": []}`

      const emptyFailure = yield* buildPage(authorPage(jsonFigure('flow-diagram', empty))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      if (Predicate.isTagged(emptyFailure, 'BlockDecodeError')) {
        expect(emptyFailure.path).toBe('nodes')
      } else {
        expect.unreachable('expected a BlockDecodeError')
      }
    })
  )

  it.effect('needs two actors and known endpoints for sequences', () =>
    Effect.gen(function* () {
      const solo = `{"actors": [{"id": "a", "label": "A"}], "messages": [{"from": "a", "to": "a", "label": "ping"}]}`

      const soloFailure = yield* buildPage(authorPage(jsonFigure('sequence-diagram', solo))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(soloFailure, 'BlockDecodeError')).toBe(true)

      const badNote = `{"actors": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}],
        "messages": [{"from": "a", "to": "b", "label": "ping"}],
        "notes": [{"text": "late", "after": 9}]}`

      const noteFailure = yield* buildPage(
        authorPage(jsonFigure('sequence-diagram', badNote))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      if (Predicate.isTagged(noteFailure, 'BlockDecodeError')) {
        expect(noteFailure.path).toContain('notes')
      } else {
        expect.unreachable('expected a BlockDecodeError')
      }
    })
  )

  it.effect('bounds tree depth, size and labels', () =>
    Effect.gen(function* () {
      const empty = '{"root": {"label": "  "}}'

      const emptyFailure = yield* buildPage(authorPage(jsonFigure('tree-diagram', empty))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(emptyFailure, 'BlockDecodeError')).toBe(true)

      let deep: ChainNode = { label: 'leaf' }

      for (let level = 0; level < 9; level += 1) {
        deep = { label: `level ${String(level)}`, children: [deep] }
      }

      const deepFailure = yield* buildPage(
        authorPage(jsonFigure('tree-diagram', JSON.stringify({ root: deep })))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      if (Predicate.isTagged(deepFailure, 'BlockDecodeError')) {
        expect(deepFailure.path).toBe('root')
      } else {
        expect.unreachable('expected a BlockDecodeError')
      }

      const kids: Array<ChainNode> = []

      for (let index = 0; index < 151; index += 1) {
        kids.push({ label: `node ${String(index)}` })
      }

      const wideFailure = yield* buildPage(
        authorPage(
          jsonFigure('tree-diagram', JSON.stringify({ root: { label: 'r', children: kids } }))
        )
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(wideFailure, 'BlockDecodeError')).toBe(true)
    })
  )

  it.effect('validates timeline dates and ordering', () =>
    Effect.gen(function* () {
      const backwards = `{"phases": [{"label": "P", "start": "2026-10-02", "end": "2026-09-01"}]}`

      const orderFailure = yield* buildPage(authorPage(jsonFigure('timeline', backwards))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      if (Predicate.isTagged(orderFailure, 'BlockDecodeError')) {
        expect(orderFailure.path).toContain('end')
      } else {
        expect.unreachable('expected a BlockDecodeError')
      }

      const badDate = `{"phases": [{"label": "P", "start": "soon", "end": "2026-09-01"}]}`

      const dateFailure = yield* buildPage(authorPage(jsonFigure('timeline', badDate))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(dateFailure, 'BlockDecodeError')).toBe(true)
    })
  )

  it.effect('needs a known initial state and known transition endpoints', () =>
    Effect.gen(function* () {
      const badInitial = `{"initial": "ghost", "states": [{"id": "a", "label": "A"}], "transitions": []}`

      const initialFailure = yield* buildPage(
        authorPage(jsonFigure('state-diagram', badInitial))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      if (Predicate.isTagged(initialFailure, 'BlockDecodeError')) {
        expect(initialFailure.path).toBe('initial')
      } else {
        expect.unreachable('expected a BlockDecodeError')
      }

      const badEdge = `{"initial": "a", "states": [{"id": "a", "label": "A"}],
        "transitions": [{"from": "a", "to": "ghost"}]}`

      const edgeFailure = yield* buildPage(authorPage(jsonFigure('state-diagram', badEdge))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(edgeFailure, 'BlockDecodeError')).toBe(true)
    })
  )
})

describe('diagrams static output', () => {
  it('renders deterministically for the same input', () => {
    const flowJson = flowDiagramComponent.examples[0]?.json ?? '{}'
    const timelineJson = timelineComponent.examples[0]?.json ?? '{}'

    const left = renderFlowDiagram(JSON.parse(flowJson), { width: 720, idPrefix: 'aha-0' })
    const right = renderFlowDiagram(JSON.parse(flowJson), { width: 720, idPrefix: 'aha-0' })

    expect(right).toBe(left)

    const top = renderTimeline(JSON.parse(timelineJson), { width: 720, idPrefix: 'aha-1' })
    const bottom = renderTimeline(JSON.parse(timelineJson), { width: 720, idPrefix: 'aha-1' })

    expect(bottom).toBe(top)
    expect(left).toContain('Tailnet gateway')
    expect(left).toContain('grp')
  })

  it.effect('keeps trees fully expanded with every label in static markup', () =>
    Effect.gen(function* () {
      const example = treeDiagramComponent.examples[0]?.json ?? '{}'

      const html = yield* buildPage(authorPage(jsonFigure('tree-diagram', example))).pipe(
        Effect.provide(stubBundles)
      )

      for (const label of [
        'Make this page public?',
        'Publish now',
        'Stay private',
        'Keep local draft'
      ]) {
        expect(html).toContain(label)
      }

      expect(html).toContain('data-sub')
      expect(html).toContain('−')
    })
  )

  it('marks static svg with the layout clients reconcile on load', () => {
    const flowJson = flowDiagramComponent.examples[0]?.json ?? '{}'
    const wide = renderFlowDiagram(JSON.parse(flowJson), { width: 720, idPrefix: 'aha-0' })
    const narrow = renderFlowDiagram(JSON.parse(flowJson), { width: 390, idPrefix: 'aha-0' })

    expect(wide).toContain('data-direction="lr"')
    expect(narrow).toContain('data-direction="tb"')

    const timelineJson = timelineComponent.examples[0]?.json ?? '{}'
    const timeline = renderTimeline(JSON.parse(timelineJson), { width: 720, idPrefix: 'aha-1' })

    expect(timeline).toContain('data-span="720"')
  })

  it.effect('marks timelines, sequences and states for their chrome', () =>
    Effect.gen(function* () {
      const timelineJson = timelineComponent.examples[0]?.json ?? '{}'

      const timelineHtml = yield* buildPage(authorPage(jsonFigure('timeline', timelineJson))).pipe(
        Effect.provide(stubBundles)
      )

      expect(timelineHtml).toContain('today')
      expect(timelineHtml).toContain('Beta cut')

      const sequenceJson = sequenceDiagramComponent.examples[0]?.json ?? '{}'

      const sequenceHtml = yield* buildPage(
        authorPage(jsonFigure('sequence-diagram', sequenceJson))
      ).pipe(Effect.provide(stubBundles))

      expect(sequenceHtml).toContain('swrap')
      expect(sequenceHtml).toContain('Messages in order')

      const stateJson = stateDiagramComponent.examples[0]?.json ?? '{}'

      const stateHtml = yield* buildPage(authorPage(jsonFigure('state-diagram', stateJson))).pipe(
        Effect.provide(stubBundles)
      )

      expect(stateHtml).toContain('sdot')
      expect(stateHtml).toContain('nfinal')
    })
  )
})
