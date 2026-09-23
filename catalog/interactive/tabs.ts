import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr, escapeHtml } from '../shared/svg.js'
import { splitLabeledSections } from './markup-sections.js'

/**
 * tabs component definition. A markup component over section children:
 * without scripts the sections stack with their headings; the client
 * turns them into an accessible tablist (arrow keys, aria).
 */

export const TABS_CSS = `
.aha-tabs { max-width: 100%; margin: 0 0 var(--unit); }
.aha-tabs .tab-h { font-size: var(--t-md); font-weight: 600; margin: 2rem 0 0.75rem; line-height: 1.5; }
.aha-tabs section:first-of-type .tab-h { margin-top: 0; }
.aha-tabs section { margin-bottom: 1.5rem; }
.aha-tabs section:last-child { margin-bottom: 0; }
.aha-tabs .tab-list { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid var(--rule); margin-bottom: 1rem; max-width: 40rem; }
.aha-tabs .tab-list [role="tab"] { font-family: var(--mono); font-size: var(--t-sm); padding: 0.5rem 1rem; border: 0; border-right: 1px solid var(--hair); background: none; color: var(--muted); cursor: pointer; }
.aha-tabs .tab-list [role="tab"]:last-child { border-right: 0; }
.aha-tabs .tab-list [role="tab"][aria-selected="true"] { color: var(--accent); box-shadow: inset 0 -2px 0 var(--accent); }
.aha-tabs .tab-list [role="tab"]:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
@media print {
  .aha-tabs section[hidden] { display: block; }
  .aha-tabs .tab-list { display: none; }
}
`

const TABS_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'children',
    type: 'markup',
    description: 'One section per tab with a data-tab label, e.g. <section data-tab="4%">.',
    required: true
  }
]

function stripGeneratedHeadings(innerHtml: string): string {
  return innerHtml.replace(/<h3 class="tab-h" data-aha-generated="true">.*?<\/h3>/gs, '')
}

function renderTabs(request: MarkupRenderRequest): Effect.Effect<string, BlockDecodeError> {
  const clean = stripGeneratedHeadings(request.innerHtml)
  const sections = splitLabeledSections(clean, 'data-tab')

  if (sections.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'tabs',
        path: 'children',
        detail: 'expected at least one <section data-tab="Label"> child'
      })
    )
  }

  let body = ''

  for (const section of sections) {
    body += `<section data-tab="${escapeAttr(section.label)}"><h3 class="tab-h" data-aha-generated="true">${escapeHtml(section.label)}</h3>${section.inner}</section>`
  }

  return Effect.succeed(
    `<div data-aha="tabs" class="aha-tabs" data-tabs-id="${escapeAttr(request.idPrefix)}">${body}</div>`
  )
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'rate-choices',
    title: 'Rate choices',
    caption: 'Three tabs; without scripts all sections stack with headings.',
    json: null,
    markup: [
      '<section data-tab="3%">',
      '<p>At 3% the payment clears the balance in 41 months and costs $4,180 in interest.</p>',
      '</section>',
      '<section data-tab="4%">',
      '<p>At 4% the payment clears the balance in 44 months and costs $5,790 in interest.</p>',
      '</section>',
      '<section data-tab="5%">',
      '<p>At 5% the payment clears the balance in 47 months and costs $7,540 in interest.</p>',
      '</section>'
    ].join('\n'),
    markupKind: null
  }
]

export const tabsComponent: CatalogComponent = {
  name: 'tabs',
  category: 'interactive',
  summary: 'Sections switching through an accessible tablist; stacked without scripts.',
  inputKind: 'markup',
  fields: TABS_FIELDS,
  css: TABS_CSS,
  clientBundle: 'tabs.client.js',
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderTabs
}
