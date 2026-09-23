import { Effect } from 'effect'

import { buildPage } from './build.js'
import type { BuildError } from './build.js'
import { catalogCategories } from './categories.js'
import { CatalogFileError } from './errors.js'
import { CatalogFileStore } from './services/catalog-file-store.js'
import { ClientBundleStore } from './services/client-bundle-store.js'
import { escapeHtml } from './shared/svg.js'

/**
 * Showcase generator. Builds one self-contained page from the house
 * template showing every catalog example twice (720px desktop pane and
 * 390px mobile pane), rendered by `aha build` itself so new components
 * appear automatically.
 */

export const SHOWCASE_DESKTOP_WIDTH = 720

export const SHOWCASE_MOBILE_WIDTH = 390

const SHOWCASE_CSS = `
.showcase-panes { display: grid; grid-template-columns: 720px 390px; gap: 1.5rem; justify-content: start; align-items: start; margin: 0 0 1rem; max-width: 100%; }
.showcase-panes > div { min-width: 0; max-width: 100%; }
.pane-frame-desktop { width: 720px; max-width: 100%; border: 1px solid var(--rule); padding: 1rem; }
.pane-frame-mobile { width: 390px; max-width: 100%; border: 1px solid var(--rule); padding: 1rem; }
.pane-frame-desktop figure, .pane-frame-mobile figure, .pane-frame-desktop aside, .pane-frame-mobile aside { margin: 0; }
.showcase-source { margin: 0 0 var(--unit); max-width: 72rem; }
.showcase-source summary { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); cursor: pointer; }
.showcase-source pre { font-size: var(--t-xs); max-height: 24rem; overflow: auto; }
@media (max-width: 76rem) {
  .showcase-panes { grid-template-columns: 1fr; }
}
`

function exampleFigure(exampleJson: string, name: string, caption: string, width: number): string {
  const captionHtml =
    caption.length === 0 ? '' : `\n<figcaption>${escapeHtml(caption)}</figcaption>`

  return `<figure data-aha="${name}" data-width="${String(width)}">\n<script type="application/json">${exampleJson}</script>${captionHtml}\n</figure>`
}

function exampleAside(name: string, markup: string, kind: string): string {
  return `<aside data-aha="${name}" data-kind="${kind}">\n${markup}\n</aside>`
}

function componentSection(
  name: string,
  summary: string,
  desktop: string,
  mobile: string,
  source: string,
  sourceLabel: string
): string {
  return `<section>\n<h2><span><code>${name}</code> — ${escapeHtml(summary)}</span></h2>\n<div class="showcase-panes">\n<div>\n<span class="lbl">Desktop · 720px</span>\n<div class="pane-frame-desktop">\n${desktop}\n</div>\n</div>\n<div>\n<span class="lbl">Mobile · 390px</span>\n<div class="pane-frame-mobile">\n${mobile}\n</div>\n</div>\n</div>\n<details class="showcase-source"><summary>${sourceLabel}</summary><pre>${escapeHtml(source)}</pre></details>\n</section>\n`
}

export function authorShowcaseSource(): string {
  let sections = ''

  for (const category of catalogCategories) {
    if (category.components.length === 0) {
      continue
    }

    sections += `<section>\n<h2><span>${escapeHtml(category.title)}</span><span class="aside">${escapeHtml(category.id)}</span></h2>\n<p>${escapeHtml(category.description)}</p>\n</section>\n`

    for (const component of category.components) {
      for (const example of component.examples) {
        if (component.inputKind === 'markup' && example.markup !== null) {
          const kind = example.markupKind ?? 'note'
          const block = exampleAside(component.name, example.markup, kind)
          sections += componentSection(
            `${component.name} · ${example.id}`,
            component.summary,
            exampleAside(component.name, example.markup, kind),
            block,
            example.markup,
            'Example markup'
          )
          continue
        }

        if (example.json !== null) {
          sections += componentSection(
            `${component.name} · ${example.id}`,
            component.summary,
            exampleFigure(example.json, component.name, example.caption, SHOWCASE_DESKTOP_WIDTH),
            exampleFigure(example.json, component.name, example.caption, SHOWCASE_MOBILE_WIDTH),
            example.json,
            'Example JSON'
          )
        }
      }
    }
  }

  return sections
}

function applyTemplate(template: string, sections: string): string {
  let page = template.replace(
    /<header class="doc">.*?<\/header>/s,
    '<header class="doc">\n<p class="kicker"><span>Catalog</span><span class="sep">/</span> <span>components</span></p>\n<h1>Aha component catalog</h1>\n<p>Every component below renders live from its example block, twice: a desktop-width pane and a 390px mobile pane. The JSON behind each example sits in a collapsed details element.</p>\n</header>'
  )

  page = page.replace(/<main>.*?<\/main>/s, `<main>\n${sections}</main>`)
  page = page.replace(/--measure:\s*44rem;/, '--measure: 72rem;')
  page = page.replace('</style>', `${SHOWCASE_CSS}</style>`)

  return page
}

export function buildShowcasePage(
  templateHtml: string
): Effect.Effect<string, BuildError, ClientBundleStore> {
  return buildPage(applyTemplate(templateHtml, authorShowcaseSource()))
}

export function writeShowcasePage(
  templateHtml: string,
  output: string
): Effect.Effect<string, BuildError | CatalogFileError, CatalogFileStore | ClientBundleStore> {
  return Effect.gen(function* () {
    const html = yield* buildShowcasePage(templateHtml)
    const store = yield* CatalogFileStore
    yield* store.writeTextFile(output, html)

    return output
  })
}
