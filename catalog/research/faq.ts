import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr } from '../shared/svg.js'

/**
 * faq component definition. A markup component over native details
 * children: questions keep working with scripts off, and the client
 * adds a single Expand all control on top. The renderer only checks
 * structure (at least one details, each with a summary) and wraps it;
 * answer markup passes through untouched.
 */

export const FAQ_CSS = `
.aha-faq { max-width: 100%; margin: 0 0 var(--unit); }
.aha-faq .faq-ctl { margin-bottom: 0.5rem; }
.aha-faq .faq-ctl button { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.06em; text-transform: uppercase; padding: 0.375rem 0.75rem; border: 1px solid var(--rule); background: none; color: var(--muted); cursor: pointer; }
.aha-faq .faq-ctl button:hover { border-color: var(--accent); color: var(--accent); }
.aha-faq .faq-ctl button:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.aha-faq details { border: 1px solid var(--rule); border-top: 0; padding: 0.625rem 1rem 0.75rem; margin: 0; max-width: 40rem; }
.aha-faq details:first-of-type { border-top: 1px solid var(--rule); }
.aha-faq summary { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; cursor: pointer; }
.aha-faq summary:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }
.aha-faq details[open] summary { color: var(--accent); }
.aha-faq details > *:last-child { margin-bottom: 0; }
@media print {
  .aha-faq .faq-ctl { display: none; }
}
`

const FAQ_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'children',
    type: 'markup',
    description:
      'One <details> per question with a <summary> holding the question and answer markup after it, e.g. <details><summary>Why the box?</summary><p>Because…</p></details>. Answers keep any flow content.',
    required: true
  }
]

function stripGeneratedControls(innerHtml: string): string {
  return innerHtml.replace(/<div class="faq-ctl"[^>]*>.*?<\/div>/gs, '')
}

function countDetails(innerHtml: string): number {
  let count = 0
  let cursor = 0

  while (cursor < innerHtml.length) {
    const at = innerHtml.indexOf('<details', cursor)

    if (at === -1) {
      break
    }

    count += 1
    cursor = at + 8
  }

  return count
}

/** Check every top-level details element carries a summary before its
 * matching close tag, so a missing question fails the build instead of
 * rendering a broken disclosure. */
function detailsWithoutSummary(innerHtml: string): number {
  let cursor = 0
  let ordinal = 0

  while (cursor < innerHtml.length) {
    const openAt = innerHtml.indexOf('<details', cursor)

    if (openAt === -1) {
      break
    }

    const openEnd = innerHtml.indexOf('>', openAt)

    if (openEnd === -1) {
      break
    }

    const closeAt = innerHtml.indexOf('</details>', openEnd)

    if (closeAt === -1) {
      break
    }

    ordinal += 1
    const body = innerHtml.slice(openEnd + 1, closeAt)

    if (!body.includes('<summary')) {
      return ordinal
    }

    cursor = closeAt + 10
  }

  return -1
}

function renderFaq(request: MarkupRenderRequest): Effect.Effect<string, BlockDecodeError> {
  const clean = stripGeneratedControls(request.innerHtml)

  if (countDetails(clean) === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'faq',
        path: 'children',
        detail: 'expected at least one <details><summary>Q</summary>…</details> child'
      })
    )
  }

  const missing = detailsWithoutSummary(clean)

  if (missing !== -1) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'faq',
        path: 'children',
        detail: `question ${String(missing)} needs a <summary> holding the question`
      })
    )
  }

  let widthAttr = ''

  for (const attr of request.attributes) {
    if (attr.name === 'data-width') {
      const parsed = Number.parseInt(attr.value, 10)

      if (Number.isSafeInteger(parsed)) {
        const clamped = Math.min(1200, Math.max(280, parsed))
        widthAttr = ` data-width="${String(clamped)}"`
      }
    }
  }

  return Effect.succeed(
    `<div data-aha="faq" class="aha-faq" data-faq-id="${escapeAttr(request.idPrefix)}"${widthAttr}>${clean}</div>`
  )
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'eval-host-questions',
    title: 'Eval-host questions',
    caption: 'Three native disclosures; scripts add a single Expand all control.',
    json: null,
    markup: [
      '<details>',
      '<summary>Why does the eval run on the tailnet box?</summary>',
      '<p>It is the only host that reads private documents and finishes inside the nightly window.</p>',
      '</details>',
      '<details>',
      '<summary>What happens if the box sleeps?</summary>',
      '<p>Wake timers bring it up before the run. If the heartbeat misses twice, the on-call gets paged.</p>',
      '</details>',
      '<details>',
      '<summary>Can Vercel cron replace it later?</summary>',
      '<p>Only if cron gains tailnet reads. Until then the timeout and the missing credential rule it out.</p>',
      '</details>'
    ].join('\n'),
    markupKind: null
  }
]

export const faqComponent: CatalogComponent = {
  name: 'faq',
  category: 'research',
  summary:
    'Questions and answers as native disclosures, with an Expand all control when scripts run.',
  inputKind: 'markup',
  fields: FAQ_FIELDS,
  css: FAQ_CSS,
  clientBundle: 'faq.client.js',
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderFaq
}
