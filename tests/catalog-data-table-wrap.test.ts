import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'

import { buildPage } from '../catalog/build.js'
import { dataTableComponent } from '../catalog/data/data-table.js'
import { DATA_TABLE_CSS } from '../catalog/data/data-table-css.js'
import { ClientBundleStore } from '../catalog/services/client-bundle-store.js'

const TABLE_JSON = `{
  "title": "Model cost per 1k tasks",
  "sortable": true,
  "columns": [
    { "key": "model", "label": "model", "type": "text" },
    { "key": "cost", "label": "cost / task", "type": "currency", "currency": "USD", "digits": 3 },
    { "key": "eval", "label": "evaluated", "type": "date", "priority": "low" }
  ],
  "rows": [
    ["Arbor", 0.31, "2026-09-18"],
    ["Beacon", 0.28, "2026-09-18"]
  ]
}`

function authorPage(body: string): string {
  return `<!doctype html>\n<html><head><title>t</title></head><body>\n${body}\n</body></html>`
}

const stubBundles = Layer.succeed(ClientBundleStore)({
  loadBundle: (name: string) => Effect.succeed(`/* bundle:${name} */`)
})

describe('data-table narrow containers', () => {
  it.effect('marks low-priority columns and keeps dates on one line', () =>
    Effect.gen(function* () {
      const source = authorPage(
        `<figure data-aha="data-table">\n<script type="application/json">${TABLE_JSON}</script>\n</figure>`
      )

      const html = yield* buildPage(source).pipe(Effect.provide(stubBundles))

      expect(html).toContain('class="dt low"')
      expect(html).toContain('Sep 18, 2026')
    })
  )

  it('hides low-priority columns by container width, never viewport', () => {
    expect(DATA_TABLE_CSS).toContain('container-type: inline-size')
    expect(DATA_TABLE_CSS).toContain('@container')
    expect(DATA_TABLE_CSS).toContain('th.low')
    expect(DATA_TABLE_CSS).toContain('td.dt')
    expect(DATA_TABLE_CSS).not.toContain('@media')
    const columns = dataTableComponent.fields.find((field) => field.path === 'columns')

    expect(columns?.description).toContain('priority')
  })
})
