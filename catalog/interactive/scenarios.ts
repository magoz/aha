import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr, escapeHtml } from '../shared/svg.js'
import { splitLabeledSections } from './markup-sections.js'

/**
 * scenarios component definition. One section per scenario holding prose
 * and nested catalog blocks (a line-chart per rate, say). Without scripts
 * every scenario stacks with its heading; the client switches a segmented
 * control between them. Nested blocks are built by build.ts before this
 * renderer sees them; charts re-measure through their ResizeObserver when
 * a hidden scenario is revealed.
 */

export const SCENARIOS_CSS = `
.aha-scenarios { max-width: 100%; margin: 0 0 var(--unit); }
.aha-scenarios .sc-h { font-size: var(--t-md); font-weight: 600; margin: 2rem 0 0.75rem; line-height: 1.5; }
.aha-scenarios section:first-of-type .sc-h { margin-top: 0; }
.aha-scenarios section { margin-bottom: 1.5rem; }
.aha-scenarios section:last-child { margin-bottom: 0; }
.aha-scenarios .seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--rule); margin-bottom: 1rem; max-width: 100%; }
.aha-scenarios .seg button { font-family: var(--mono); font-size: var(--t-sm); padding: 0.5rem 1rem; border: 0; border-right: 1px solid var(--hair); background: none; color: var(--muted); cursor: pointer; }
.aha-scenarios .seg button:last-child { border-right: 0; }
.aha-scenarios .seg button[aria-pressed="true"] { color: var(--paper); background: var(--ink); }
.aha-scenarios .seg button:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
@media print {
  .aha-scenarios section[hidden] { display: block; }
  .aha-scenarios .seg { display: none; }
}
`

const SCENARIOS_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'children',
    type: 'markup',
    description:
      'One section per scenario with a data-scenario label; sections may hold nested catalog blocks.',
    required: true
  }
]

function stripGeneratedHeadings(innerHtml: string): string {
  return innerHtml.replace(/<h3 class="sc-h" data-aha-generated="true">.*?<\/h3>/gs, '')
}

function renderScenarios(request: MarkupRenderRequest): Effect.Effect<string, BlockDecodeError> {
  const clean = stripGeneratedHeadings(request.innerHtml)
  const sections = splitLabeledSections(clean, 'data-scenario')

  if (sections.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'scenarios',
        path: 'children',
        detail: 'expected at least one <section data-scenario="Label"> child'
      })
    )
  }

  let body = ''

  for (const section of sections) {
    body += `<section data-scenario="${escapeAttr(section.label)}"><h3 class="sc-h" data-aha-generated="true">${escapeHtml(section.label)}</h3>${section.inner}</section>`
  }

  return Effect.succeed(
    `<div data-aha="scenarios" class="aha-scenarios" data-scenarios-id="${escapeAttr(request.idPrefix)}">${body}</div>`
  )
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'mortgage-rates',
    title: 'What if the rate were 4%',
    caption: 'Two scenarios, each with prose and its own chart.',
    json: null,
    markup: [
      '<section data-scenario="3%">',
      '<p>At 3% the loan costs $4,180 in interest and clears in 41 months.</p>',
      '<figure data-aha="line-chart">',
      '<script type="application/json">{"title": "Balance at 3%", "x": {"kind": "category"}, "series": [{"name": "balance", "highlight": true, "values": [{"x": "yr 0", "y": 100}, {"x": "yr 1", "y": 76}, {"x": "yr 2", "y": 51}, {"x": "yr 3", "y": 27}, {"x": "yr 4", "y": 0}]}]}</script>',
      '</figure>',
      '</section>',
      '<section data-scenario="5%">',
      '<p>At 5% the loan costs $7,540 in interest and clears in 47 months.</p>',
      '<figure data-aha="line-chart">',
      '<script type="application/json">{"title": "Balance at 5%", "x": {"kind": "category"}, "series": [{"name": "balance", "highlight": true, "values": [{"x": "yr 0", "y": 100}, {"x": "yr 1", "y": 81}, {"x": "yr 2", "y": 60}, {"x": "yr 3", "y": 38}, {"x": "yr 4", "y": 12}]}]}</script>',
      '</figure>',
      '</section>'
    ].join('\n'),
    markupKind: null
  }
]

export const scenariosComponent: CatalogComponent = {
  name: 'scenarios',
  category: 'interactive',
  summary: 'What-if sections with nested blocks, switching through a segmented control.',
  inputKind: 'markup',
  fields: SCENARIOS_FIELDS,
  css: SCENARIOS_CSS,
  clientBundle: 'scenarios.client.js',
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderScenarios
}
