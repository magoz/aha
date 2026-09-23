import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr } from '../shared/svg.js'

/**
 * callout component definition. The markup-light path: it wraps author
 * prose instead of taking JSON, and normalizes the wrapper to the house
 * callout style. No client code, no details fallback needed.
 */

export const CALLOUT_CSS = `
.callout { margin: 0 0 var(--unit); padding: 0.25rem 0 0.25rem 1rem; border-left: 2px solid var(--ink); max-width: 40rem; }
.callout .lbl { display: block; margin-bottom: 0.25rem; color: inherit; font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; }
.callout p:last-child { margin-bottom: 0; }
.callout.decision { border-left-color: var(--accent); }
.callout.decision .lbl { color: var(--accent); }
.callout.warning { border-left-color: var(--warn); }
.callout.warning .lbl { color: var(--warn); }
.callout.note .lbl { color: var(--muted); }
.callout.tip { border-left-color: var(--accent); }
.callout.tip .lbl { color: var(--accent); }
`

const CALLOUT_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'data-kind',
    type: 'note | decision | warning | tip',
    description: 'Callout kind on the aside element; defaults to note.',
    required: false
  },
  {
    path: 'children',
    type: 'markup',
    description: 'Author prose inside the aside; any flow content.',
    required: true
  }
]

function readKind(request: MarkupRenderRequest): string {
  for (const attr of request.attributes) {
    if (attr.name === 'data-kind') {
      return attr.value
    }
  }

  return 'note'
}

function labelFor(kind: string): string {
  if (kind === 'decision') {
    return 'Decision'
  }

  if (kind === 'warning') {
    return 'Warning'
  }

  if (kind === 'tip') {
    return 'Tip'
  }

  return 'Note'
}

function stripGeneratedLabel(innerHtml: string): string {
  return innerHtml.replace(/<span class="lbl" data-aha-generated="true">.*?<\/span>/s, '')
}

function renderCallout(request: MarkupRenderRequest): Effect.Effect<string, BlockDecodeError> {
  const kind = readKind(request)

  if (kind !== 'note' && kind !== 'decision' && kind !== 'warning' && kind !== 'tip') {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'callout',
        path: 'data-kind',
        detail: `expected note, decision, warning or tip, got ${kind}`
      })
    )
  }

  const inner = stripGeneratedLabel(request.innerHtml).trim()

  if (inner.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'callout',
        path: 'children',
        detail: 'expected prose inside the callout'
      })
    )
  }

  return Effect.succeed(
    `<aside data-aha="callout" data-kind="${escapeAttr(kind)}" class="callout ${kind}"><span class="lbl" data-aha-generated="true">${labelFor(kind)}</span>${inner}</aside>`
  )
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'decision-callout',
    title: 'Decision callout',
    caption: 'A decision with its trade-off in one callout.',
    json: null,
    markup:
      '<p>Serve private documents through the loopback gateway so the origin only ever sees a credentialed request.</p>',
    markupKind: 'decision'
  }
]

export const calloutComponent: CatalogComponent = {
  name: 'callout',
  category: 'text',
  summary: 'House callout (note, decision, warning, tip) wrapping author prose.',
  inputKind: 'markup',
  markupTag: 'aside',
  fields: CALLOUT_FIELDS,
  css: CALLOUT_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderCallout
}
