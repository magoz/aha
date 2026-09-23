import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Predicate } from 'effect'

import { buildPage } from '../catalog/build.js'
import { formatComponentDetail } from '../catalog/components.js'
import { annotatedCodeComponent } from '../catalog/code/annotated-code.js'
import { notesForLine, splitCodeLines } from '../catalog/code/annotated-code-render.js'
import { commandComponent } from '../catalog/code/command.js'
import { fileTreeComponent } from '../catalog/code/file-tree.js'
import { buildFileTree, countTreeFiles, parseTreePath } from '../catalog/code/file-tree-render.js'
import { schemaTableComponent } from '../catalog/code/schema-table.js'
import { flattenSchemaFields, schemaHasExamples } from '../catalog/code/schema-table-render.js'
import { sideBySideComponent } from '../catalog/code/side-by-side.js'
import { splitPaneLines } from '../catalog/code/side-by-side-render.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

function jsonFigure(name: string, json: string): string {
  return `<figure data-aha="${name}">\n<script type="application/json">${json}</script>\n</figure>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

const ANNOTATED_JSON = `{
  "language": "ts",
  "filename": "gateway/retry.ts",
  "code": "const a = 1\\nconst b = 2\\nconst c = 3\\n",
  "notes": [
    { "lines": [1, 3], "title": "Edges", "text": "First and last lines." },
    { "lines": [2], "title": "Middle", "text": "The middle line." }
  ]
}`

const TREE_JSON = `{
  "title": "Tree",
  "entries": [
    { "path": "gateway/policy.ts", "status": "changed", "note": "adds refusal" },
    { "path": "gateway/server.ts", "status": "renamed", "previous": "gateway/gateway.ts" },
    { "path": "gateway/legacy.ts", "status": "removed" },
    { "path": "README.md" }
  ]
}`

const SCHEMA_JSON = `{
  "title": "POST /api/ahas",
  "fields": [
    { "name": "id", "type": "string", "required": true, "description": "Doc id.", "example": "nightly-eval" },
    { "name": "limits", "type": "object", "fields": [
      { "name": "maxBytes", "type": "number", "default": "2097152", "description": "Largest body." }
    ] }
  ]
}`

const COMMAND_JSON = `{
  "command": "pnpm verify",
  "cwd": "~/aha",
  "output": [
    { "text": "format: ok" },
    { "text": "typecheck failed", "stderr": true }
  ],
  "exitCode": 1
}`

const SBS_JSON = `{
  "left": { "label": "Before", "language": "ts", "text": "const a = 1\\nconst b = 2\\n" },
  "right": { "label": "After", "language": "ts", "text": "const a = 1\\nconst b = 3\\n", "changedLines": [2] }
}`

describe('code components', () => {
  it.effect('annotated-code renders markers, notes and header', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('annotated-code', ANNOTATED_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('gateway/retry.ts')
      expect(html).toContain('[1]')
      expect(html).toContain('[2]')
      expect(html).toContain('data-notes="0"')
      expect(html).toContain('data-note="1"')
      expect(html).toContain('tabindex="0"')
      expect(html).toContain('/* bundle:annotated-code.client.js */')
    })
  )

  it.effect('file-tree groups folders with glyph-plus-word markers', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('file-tree', TREE_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('gateway/')
      expect(html).toContain('policy.ts')
      expect(html).toContain('changed: ')
      expect(html).toContain('renamed: ')
      expect(html).toContain('gateway.ts')
      expect(html).toContain('struck')
      expect(html).toContain('aria-expanded="true"')
      expect(html).toContain('/* bundle:file-tree.client.js */')
    })
  )

  it.effect('schema-table renders dotted paths and the example column', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('schema-table', SCHEMA_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('limits.maxBytes')
      expect(html).toContain('required')
      expect(html).toContain('optional')
      expect(html).toContain('nightly-eval')
      expect(html).toContain('<th scope="col">example</th>')
      expect(html).not.toContain('bundle:')
    })
  )

  it.effect('command renders prompt, lanes and exit badge', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('command', COMMAND_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('pnpm verify')
      expect(html).toContain('~/aha')
      expect(html).toContain('stderr: ')
      expect(html).toContain('exit 1')
      expect(html).toContain('copy')
      expect(html).toContain('/* bundle:command.client.js */')
    })
  )

  it.effect('side-by-side renders two labelled panes with marked lines', () =>
    Effect.gen(function* () {
      const html = yield* buildPage(authorPage(jsonFigure('side-by-side', SBS_JSON))).pipe(
        Effect.provide(stubBundles)
      )

      expect(html).toContain('Before')
      expect(html).toContain('After')
      expect(html).toContain('class="chg"')
      expect(html).toContain('changed: ')
      expect(html).not.toContain('bundle:')
    })
  )

  it.effect('rejects notes pointing past the last line', () =>
    Effect.gen(function* () {
      const bad = '{"code": "a\\n", "notes": [{"lines": [2], "title": "X", "text": "Y"}]}'

      const failure = yield* buildPage(authorPage(jsonFigure('annotated-code', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('annotated-code')
        expect(failure.path).toBe('notes[0].lines[0]')
      }
    })
  )

  it.effect('rejects unsafe tree paths', () =>
    Effect.gen(function* () {
      const bad = '{"entries": [{"path": "../secret"}]}'

      const failure = yield* buildPage(authorPage(jsonFigure('file-tree', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.component).toBe('file-tree')
        expect(failure.path).toBe('entries[0].path')
      }
    })
  )

  it.effect('rejects previous without a rename', () =>
    Effect.gen(function* () {
      const bad = '{"entries": [{"path": "a.ts", "previous": "b.ts"}]}'

      const failure = yield* buildPage(authorPage(jsonFigure('file-tree', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toBe('entries[0].previous')
      }
    })
  )

  it.effect('rejects empty schema fields and dotted names', () =>
    Effect.gen(function* () {
      const empty = yield* buildPage(authorPage(jsonFigure('schema-table', '{"fields": []}'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(empty, 'BlockDecodeError')).toBe(true)

      const dotted = yield* buildPage(
        authorPage(jsonFigure('schema-table', '{"fields": [{"name": "a.b", "type": "string"}]}'))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(dotted, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(dotted, 'BlockDecodeError')) {
        expect(dotted.path).toBe('fields[0].name')
      }
    })
  )

  it.effect('rejects empty commands and wild exit codes', () =>
    Effect.gen(function* () {
      const empty = yield* buildPage(authorPage(jsonFigure('command', '{"command": "  "}'))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(empty, 'BlockDecodeError')).toBe(true)

      const wild = yield* buildPage(
        authorPage(jsonFigure('command', '{"command": "ls", "exitCode": 256}'))
      ).pipe(Effect.provide(stubBundles), Effect.flip)

      expect(Predicate.isTagged(wild, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(wild, 'BlockDecodeError')) {
        expect(wild.path).toBe('exitCode')
      }
    })
  )

  it.effect('rejects changed lines on prose panes', () =>
    Effect.gen(function* () {
      const bad =
        '{"left": {"label": "A", "text": "hi"}, "right": {"label": "B", "text": "yo", "changedLines": [1]}}'

      const failure = yield* buildPage(authorPage(jsonFigure('side-by-side', bad))).pipe(
        Effect.provide(stubBundles),
        Effect.flip
      )

      expect(Predicate.isTagged(failure, 'BlockDecodeError')).toBe(true)

      if (Predicate.isTagged(failure, 'BlockDecodeError')) {
        expect(failure.path).toBe('right.changedLines')
      }
    })
  )

  it.effect('rebuilds idempotently and inlines only used bundles', () =>
    Effect.gen(function* () {
      const source = authorPage(
        `${jsonFigure('annotated-code', ANNOTATED_JSON)}\n${jsonFigure('schema-table', SCHEMA_JSON)}`
      )

      const first = yield* buildPage(source).pipe(Effect.provide(stubBundles))
      const rebuilt = yield* buildPage(first).pipe(Effect.provide(stubBundles))

      expect(rebuilt).toBe(first)
      expect(first).toContain('/* bundle:annotated-code.client.js */')
      expect(first).not.toContain('bundle:file-tree.client.js')
      expect(first).not.toContain('bundle:command.client.js')
    })
  )

  it('maps note indexes to lines', () => {
    const input = {
      code: 'a\nb\nc\n',
      notes: [
        { lines: [1, 3], title: 'Edges', text: 'E.' },
        { lines: [2], title: 'Middle', text: 'M.' }
      ]
    }

    expect(notesForLine(input, 1)).toEqual([0])
    expect(notesForLine(input, 2)).toEqual([1])
    expect(notesForLine(input, 3)).toEqual([0])
    expect(splitCodeLines('a\nb\n')).toEqual(['a', 'b'])
  })

  it('groups tree paths and counts files', () => {
    expect(parseTreePath('./gateway/policy.ts')).toEqual(['gateway', 'policy.ts'])
    expect(parseTreePath('../secret')).toBe(null)
    expect(parseTreePath('a//b')).toBe(null)
    expect(parseTreePath('')).toBe(null)

    const root = buildFileTree([
      { path: 'gateway/policy.ts' },
      { path: 'gateway/forward.ts' },
      { path: 'README.md' }
    ])

    expect(root.dirs.length).toBe(1)
    expect(root.files.length).toBe(1)
    expect(countTreeFiles(root)).toBe(3)
  })

  it('flattens nested fields into dotted paths', () => {
    const fields = [
      {
        name: 'limits',
        type: 'object',
        fields: [{ name: 'maxBytes', type: 'number' }]
      },
      { name: 'id', type: 'string', example: 'x' }
    ]

    const flat = flattenSchemaFields(fields, '', 0)

    expect(flat.map((row) => row.path)).toEqual(['limits', 'limits.maxBytes', 'id'])
    expect(flat[1]?.depth).toBe(1)
    expect(schemaHasExamples(fields)).toBe(true)
    expect(schemaHasExamples([{ name: 'id', type: 'string' }])).toBe(false)
    expect(splitPaneLines('a\nb\n')).toEqual(['a', 'b'])
  })

  it('teaches every component through aha components output', () => {
    const names = ['annotated-code', 'file-tree', 'schema-table', 'command', 'side-by-side']

    for (const name of names) {
      const detail = formatComponentDetail(name, false)

      expect(detail).not.toBe(null)

      if (detail !== null) {
        expect(detail).toContain(name)
        expect(detail).toContain('<figure data-aha=')
      }
    }

    expect(annotatedCodeComponent.examples.length).toBeGreaterThan(0)
    expect(fileTreeComponent.examples.length).toBeGreaterThan(0)
    expect(schemaTableComponent.examples.length).toBeGreaterThan(0)
    expect(commandComponent.examples.length).toBeGreaterThan(0)
    expect(sideBySideComponent.examples.length).toBeGreaterThan(0)
    expect(annotatedCodeComponent.clientBundle).toBe('annotated-code.client.js')
    expect(fileTreeComponent.clientBundle).toBe('file-tree.client.js')
    expect(commandComponent.clientBundle).toBe('command.client.js')
    expect(schemaTableComponent.clientBundle).toBe(null)
    expect(sideBySideComponent.clientBundle).toBe(null)
  })
})
