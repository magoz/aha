import { Effect } from 'effect'

import type { CatalogComponent, ComponentExample, MarkupRenderRequest } from '../component.js'
import type { FieldDoc } from '../component.js'
import { BlockDecodeError } from '../errors.js'
import { escapeAttr } from '../shared/svg.js'

/**
 * definition-list component definition. A house glossary: terms keep their
 * markup, every term gets a stable anchor, and rebuilds strip the
 * generated anchor links so output stays idempotent. No client code.
 */

export const DEFINITION_LIST_CSS = `
.aha-defs { margin: 0 0 var(--unit); max-width: 40rem; }
.aha-defs dt { font-family: var(--mono); font-weight: 600; font-size: var(--t-sm); margin-top: 0.75rem; scroll-margin-top: 1rem; }
.aha-defs dt:first-of-type { margin-top: 0; }
.aha-defs dt .dl-anchor { font-weight: 400; color: var(--muted); text-decoration: none; margin-left: 0.5em; }
.aha-defs dt .dl-anchor:hover { color: var(--accent); }
.aha-defs dd { margin: 0.125rem 0 0; }
.aha-defs dd p:last-child { margin-bottom: 0; }
`

const DEFINITION_LIST_FIELDS: ReadonlyArray<FieldDoc> = [
  {
    path: 'children',
    type: 'markup',
    description: 'One dt per term followed by its dd; dt keeps an id or gains one from its text.',
    required: true
  }
]

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

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function slugify(text: string): string {
  const lowered = stripTags(text).toLowerCase()
  let out = ''

  for (const char of lowered) {
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
      out += char
      continue
    }

    if (out.length > 0 && !out.endsWith('-')) {
      out += '-'
    }
  }

  let end = out.length

  while (end > 0 && out[end - 1] === '-') {
    end -= 1
  }

  return out.slice(0, end)
}

function stripGeneratedAnchors(innerHtml: string): string {
  return innerHtml.replace(/<a class="dl-anchor" data-aha-generated="true".*?<\/a>/gs, '')
}

interface TermSlot {
  readonly dtOpen: string
  readonly dtInner: string
  readonly id: string
}

function collectTerms(innerHtml: string): ReadonlyArray<TermSlot> {
  const out: Array<TermSlot> = []
  const seen: Array<string> = []
  const pattern = /<dt([^>]*)>([\s\S]*?)<\/dt>/g
  let match: RegExpExecArray | null = pattern.exec(innerHtml)

  while (match !== null) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    const kept = readAttribute(`<dt${attrs}>`, 'id')
    let base = kept ?? slugify(body)

    if (base.length === 0) {
      base = 'term'
    }

    let candidate = base
    let suffix = 2

    while (seen.includes(candidate)) {
      candidate = `${base}-${String(suffix)}`
      suffix += 1
    }

    seen.push(candidate)
    out.push({ dtOpen: attrs, dtInner: body, id: candidate })
    match = pattern.exec(innerHtml)
  }

  return out
}

function renderDefinitionList(
  request: MarkupRenderRequest
): Effect.Effect<string, BlockDecodeError> {
  const clean = stripGeneratedAnchors(request.innerHtml)
  const terms = collectTerms(clean)

  if (terms.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: request.blockIndex,
        component: 'definition-list',
        path: 'children',
        detail: 'expected at least one dt term with its dd definition'
      })
    )
  }

  let body = clean

  for (const term of terms) {
    const withId = readAttribute(`<dt${term.dtOpen}>`, 'id') === null
    const open = withId ? `<dt${term.dtOpen} id="${escapeAttr(term.id)}">` : `<dt${term.dtOpen}>`
    const anchor = `<a class="dl-anchor" data-aha-generated="true" href="#${escapeAttr(term.id)}" aria-label="Link to ${escapeAttr(stripTags(term.dtInner))}">#</a>`
    const source = `<dt${term.dtOpen}>${term.dtInner}</dt>`
    const replacement = `${open}${term.dtInner}${anchor}</dt>`

    body = body.replace(source, () => replacement)
  }

  return Effect.succeed(`<dl data-aha="definition-list" class="aha-defs">${body}</dl>`)
}

const EXAMPLES: ReadonlyArray<ComponentExample> = [
  {
    id: 'inference-knobs',
    title: 'Inference knobs',
    caption: 'Three terms with stable anchors.',
    json: null,
    markup: [
      '<dt id="temperature">temperature</dt>',
      '<dd><p>Sampling randomness per token, 0 to 2. Lower values repeat the most likely continuation; higher values wander.</p></dd>',
      '<dt>top-p</dt>',
      '<dd><p>Nucleus cutoff: the model samples from the smallest set of tokens covering probability mass p.</p></dd>',
      '<dt>max tokens</dt>',
      '<dd><p>Hard cap on the response length. Hitting it mid-sentence truncates, so budget headroom for the closing.</p></dd>'
    ].join('\n'),
    markupKind: null
  }
]

export const definitionListComponent: CatalogComponent = {
  name: 'definition-list',
  category: 'text',
  summary: 'Terms and definitions with a stable anchor on every term.',
  inputKind: 'markup',
  markupTag: 'dl',
  fields: DEFINITION_LIST_FIELDS,
  css: DEFINITION_LIST_CSS,
  clientBundle: null,
  examples: EXAMPLES,
  renderJson: null,
  renderMarkup: renderDefinitionList
}
