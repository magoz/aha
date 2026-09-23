import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr, escapeHtml } from '../shared/svg.js'

/**
 * quote component definition. A pull quote with attribution, role, and
 * an optional source link and date, in the house style: a left rule and
 * a muted mono attribution line, no quotation-mark graphics. No client
 * code. The credit line is a child paragraph (like steps' data-step and
 * checklist's data-group), so the showcase needs no shared change; the
 * output normalizes to a figure.
 */

export const QUOTE_CSS = `
.aha-quote { margin: 0 0 var(--unit); padding: 0.25rem 0 0.25rem 1rem; border-left: 2px solid var(--ink); max-width: 40rem; }
.aha-quote .q-text { font-size: var(--t-lg); line-height: 1.5; }
.aha-quote .q-text p:first-child { margin-top: 0; }
.aha-quote .q-text p:last-child { margin-bottom: 0; }
.aha-quote figcaption { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin-top: 0.5rem; }
.aha-quote figcaption .by { color: var(--ink); }
.aha-quote figcaption a { color: inherit; text-decoration: underline; text-underline-offset: 0.125em; }
.aha-quote figcaption a:hover { color: var(--accent); }
`

const QUOTE_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'children',
    type: 'markup',
    description: 'The quoted prose, usually one paragraph.',
    required: true
  },
  {
    path: 'p[data-by]',
    type: 'markup',
    description: 'One credit paragraph with data-by="Name"; its text is replaced by the caption.',
    required: true
  },
  {
    path: 'p[data-role]',
    type: 'string',
    description: 'Role on the credit paragraph, shown after the name.',
    required: false
  },
  {
    path: 'p[data-source]',
    type: 'string',
    description: 'Source title on the credit paragraph.',
    required: false
  },
  {
    path: 'p[data-source-href]',
    type: 'string',
    description: 'Source link on the credit paragraph; must start with https://.',
    required: false
  },
  {
    path: 'p[data-date]',
    type: 'string',
    description: 'Source date on the credit paragraph as YYYY-MM-DD.',
    required: false
  }
]

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function readAttribute(openTag: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*"([^"]*)"`)
  const match = pattern.exec(openTag)

  if (match === null) {
    return null
  }

  const value = match[1]

  if (value === undefined) {
    return null
  }

  return value
}

interface CreditLine {
  readonly source: string | null
  readonly by: string
  readonly role: string | null
  readonly sourceTitle: string | null
  readonly href: string | null
  readonly date: string | null
}

function collectCredits(innerHtml: string): Array<CreditLine> {
  const out: Array<CreditLine> = []
  const pattern = /<p([^>]*)>([\s\S]*?)<\/p>/g
  let match: RegExpExecArray | null = pattern.exec(innerHtml)

  while (match !== null) {
    const attrs = match[1] ?? ''
    const full = match[0] ?? ''
    const by = readAttribute(`<p${attrs}>`, 'data-by')

    if (by !== null) {
      out.push({
        source: full,
        by,
        role: readAttribute(`<p${attrs}>`, 'data-role'),
        sourceTitle: readAttribute(`<p${attrs}>`, 'data-source'),
        href: readAttribute(`<p${attrs}>`, 'data-source-href'),
        date: readAttribute(`<p${attrs}>`, 'data-date')
      })
    }

    match = pattern.exec(innerHtml)
  }

  return out
}

function renderCaption(credit: CreditLine): string {
  let line = `— <span class="by">${escapeHtml(credit.by)}</span>`

  if (credit.role !== null && credit.role.length > 0) {
    line += `, ${escapeHtml(credit.role)}`
  }

  if (credit.sourceTitle !== null && credit.sourceTitle.length > 0) {
    if (credit.href !== null && credit.href.length > 0) {
      line += ` · <a href="${escapeAttr(credit.href)}">${escapeHtml(credit.sourceTitle)}</a>`
    } else {
      line += ` · ${escapeHtml(credit.sourceTitle)}`
    }
  }

  if (credit.date !== null && credit.date.length > 0) {
    line += ` · ${escapeHtml(credit.date)}`
  }

  return line
}

function readRequestAttribute(request: MarkupRenderRequest, name: string): string | null {
  for (const attr of request.attributes) {
    if (attr.name === name) {
      return attr.value
    }
  }

  return null
}

const GENERATED_TEXT_OPEN = '<div class="q-text" data-aha-generated="true">'

function stripGeneratedFrame(innerHtml: string): string {
  const captioned = innerHtml.replace(
    /<figcaption data-aha-generated="true">.*?<\/figcaption>/s,
    ''
  )

  const trimmed = captioned.trim()

  if (trimmed.startsWith(GENERATED_TEXT_OPEN) && trimmed.endsWith('</div>')) {
    return trimmed.slice(GENERATED_TEXT_OPEN.length, trimmed.length - '</div>'.length)
  }

  return captioned
}

function renderQuote(request: MarkupRenderRequest): Effect.Effect<string, BlockDecodeError> {
  const fail = (path: string, detail: string): Effect.Effect<never, BlockDecodeError> =>
    Effect.fail(
      new BlockDecodeError({ blockIndex: request.blockIndex, component: 'quote', path, detail })
    )

  const clean = stripGeneratedFrame(request.innerHtml)
  const credits = collectCredits(clean)

  if (credits.length > 1) {
    return fail('p[data-by]', 'expected a single credit paragraph, found more than one')
  }

  const fromChild = credits[0]
  const fromAttrs = readRequestAttribute(request, 'data-by')

  const credit: CreditLine | null =
    fromChild !== undefined
      ? fromChild
      : fromAttrs === null
        ? null
        : {
            source: null,
            by: fromAttrs,
            role: readRequestAttribute(request, 'data-role'),
            sourceTitle: readRequestAttribute(request, 'data-source'),
            href: readRequestAttribute(request, 'data-source-href'),
            date: readRequestAttribute(request, 'data-date')
          }

  if (credit === null) {
    return fail('p[data-by]', 'expected one credit paragraph with data-by="Name"')
  }

  if (credit.by.trim().length === 0) {
    return fail('p[data-by]', 'expected an attribution name in data-by')
  }

  if (credit.href !== null && credit.href.length > 0 && !credit.href.startsWith('https://')) {
    return fail('p[data-source-href]', 'expected the source link to start with https://')
  }

  if (credit.date !== null && credit.date.length > 0 && DATE_PATTERN.exec(credit.date) === null) {
    return fail('p[data-date]', `expected an ISO date YYYY-MM-DD, got ${credit.date}`)
  }

  const prose =
    credit.source === null ? clean.trim() : clean.replace(credit.source, () => '').trim()

  if (prose.length === 0) {
    return fail('children', 'expected the quoted prose before the credit paragraph')
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

  const creditAttrs =
    ` data-by="${escapeAttr(credit.by)}"` +
    (credit.role === null ? '' : ` data-role="${escapeAttr(credit.role)}"`) +
    (credit.sourceTitle === null ? '' : ` data-source="${escapeAttr(credit.sourceTitle)}"`) +
    (credit.href === null ? '' : ` data-source-href="${escapeAttr(credit.href)}"`) +
    (credit.date === null ? '' : ` data-date="${escapeAttr(credit.date)}"`)

  return Effect.succeed(
    `<figure data-aha="quote" class="aha-quote"${widthAttr}${creditAttrs}><div class="q-text" data-aha-generated="true">${prose}</div><figcaption data-aha-generated="true">${renderCaption(credit)}</figcaption></figure>`
  )
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'held-lightly',
    title: 'Sourced quote',
    caption: 'A pull quote with role, source link and date.',
    json: null,
    markup: [
      '<p>We shape our tools, and then our tools shape us back; the loop is tighter when the tool writes back.</p>',
      '<p data-by="Mara Voss" data-role="staff engineer" data-source="Small tools, held lightly" data-source-href="https://example.org/small-tools" data-date="2026-03-14">Mara Voss</p>'
    ].join('\n'),
    markupKind: null
  },
  {
    id: 'plain-credit',
    title: 'Plain credit',
    caption: 'A pull quote with only a name.',
    json: null,
    markup: [
      '<p>Small pages win: one idea, one chart, one decision, then stop.</p>',
      '<p data-by="Jonas Reber">Jonas Reber</p>'
    ].join('\n'),
    markupKind: null
  }
]

export const quoteComponent: CatalogComponent = {
  name: 'quote',
  category: 'plans',
  summary: 'A pull quote with attribution, role, and an optional source link and date.',
  inputKind: 'markup',
  markupTag: 'figure',
  fields: QUOTE_FIELDS,
  css: QUOTE_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderQuote
}
