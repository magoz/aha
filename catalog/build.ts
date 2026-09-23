import { Effect } from 'effect'

import {
  findRootBlocks,
  readBlockWidth,
  spliceBlocks,
  stripGeneratedInner,
  stripPageAssets
} from './blocks.js'
import type { FoundBlock } from './blocks.js'
import { findCatalogComponent } from './categories.js'
import type { JsonValue } from './json-value.js'
import { BlockDecodeError, ClientBundleMissingError, UnknownComponentError } from './errors.js'
import { ClientBundleStore } from './services/client-bundle-store.js'

/**
 * Catalog page build. `buildPage` is the domain entrypoint: it yields the
 * bundle service, renders each block with Effect.forEach, and splices the
 * results back byte-for-byte. Pure scanning and splicing stay plain
 * functions in blocks.ts; rendering stays plain functions in each
 * component; only this orchestration is effectful.
 */

export type BuildError = UnknownComponentError | BlockDecodeError | ClientBundleMissingError

/** Nesting cap for blocks inside markup components (scenarios holding
 * charts). Deep enough for real pages, shallow enough to stop a
 * self-referencing template from looping forever. */
export const MAX_NEST_DEPTH = 4

interface RenderedTree {
  readonly html: string
  readonly used: ReadonlyArray<string>
}

function parseJsonPayload(
  block: FoundBlock,
  index: number
): Effect.Effect<JsonValue, BlockDecodeError> {
  if (block.kind !== 'json') {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: index,
        component: block.name,
        path: 'script',
        detail: 'expected a JSON script block'
      })
    )
  }

  const text = block.jsonText.trim()

  if (text.length === 0) {
    return Effect.fail(
      new BlockDecodeError({
        blockIndex: index,
        component: block.name,
        path: 'script',
        detail: 'expected JSON in the application/json script'
      })
    )
  }

  return Effect.try({
    try: (): JsonValue => JSON.parse(text),
    catch: () =>
      new BlockDecodeError({
        blockIndex: index,
        component: block.name,
        path: 'script',
        detail: 'invalid JSON in the application/json script'
      })
  })
}

function renderFoundBlock(
  block: FoundBlock,
  index: number,
  idPrefix: string,
  depth: number
): Effect.Effect<RenderedTree, UnknownComponentError | BlockDecodeError> {
  return Effect.gen(function* () {
    const component = findCatalogComponent(block.name)

    if (component === null) {
      return yield* Effect.fail(new UnknownComponentError({ name: block.name }))
    }

    if (block.kind === 'json') {
      if (component.renderJson === null) {
        return yield* Effect.fail(
          new BlockDecodeError({
            blockIndex: index,
            component: block.name,
            path: '',
            detail: `${block.name} wraps prose and takes no JSON`
          })
        )
      }

      const payload = yield* parseJsonPayload(block, index)
      const width = readBlockWidth(block.openTag) ?? 640

      const rendered = yield* component.renderJson({
        blockIndex: index,
        idPrefix,
        width,
        json: payload
      })

      const clean = stripGeneratedInner(block.inner)
      const html = replaceJsonInner(block, clean, rendered, component.name)

      return { html, used: [component.name] }
    }

    if (component.renderMarkup === null) {
      return yield* Effect.fail(
        new BlockDecodeError({
          blockIndex: index,
          component: block.name,
          path: '',
          detail: `${block.name} takes JSON data, not prose`
        })
      )
    }

    // Nested blocks (a chart inside a scenarios section) are built in the
    // author's inner HTML before the markup renderer sees it, so the
    // renderer's own wrapper is never rescanned and rebuilds stay stable.
    let innerHtml = block.inner
    let nestedUsed: ReadonlyArray<string> = []

    if (depth < MAX_NEST_DEPTH) {
      const nested = yield* renderBlockTree(block.inner, `${idPrefix}-in`, depth + 1)
      innerHtml = nested.html
      nestedUsed = nested.used
    }

    const rendered = yield* component.renderMarkup({
      blockIndex: index,
      idPrefix,
      attributes: block.attributes,
      innerHtml
    })

    return { html: rendered, used: [component.name, ...nestedUsed] }
  })
}

/** Render every root block in `source`, recursing into markup output so
 * nested blocks (charts inside scenarios) are built and idempotent. */
function renderBlockTree(
  source: string,
  prefix: string,
  depth: number
): Effect.Effect<RenderedTree, UnknownComponentError | BlockDecodeError> {
  return Effect.gen(function* () {
    const blocks = findRootBlocks(source)

    const rendered = yield* Effect.forEach(blocks, (block, index) =>
      renderFoundBlock(block, index, `${prefix}-${String(index)}-${block.name}`, depth)
    )

    const html = spliceBlocks(
      source,
      blocks,
      rendered.map((entry) => entry.html)
    )

    const used: Array<string> = []

    for (const entry of rendered) {
      for (const name of entry.used) {
        let seen = false

        for (const known of used) {
          if (known === name) {
            seen = true
            break
          }
        }

        if (!seen) {
          used.push(name)
        }
      }
    }

    return { html, used }
  })
}

function replaceJsonInner(
  block: Extract<FoundBlock, { kind: 'json' }>,
  cleanInner: string,
  rendered: string,
  name: string
): string {
  const scriptClose = cleanInner.indexOf('</script>')

  if (scriptClose === -1) {
    return `${block.openTag}${cleanInner}\n<!--aha:render:${name}-->\n${rendered}\n<!--/aha:render-->\n</${block.tag}>`
  }

  const head = cleanInner.slice(0, scriptClose + '</script>'.length)
  const tail = cleanInner.slice(scriptClose + '</script>'.length)

  return `${block.openTag}${head}\n<!--aha:render:${name}-->\n${rendered}\n<!--/aha:render-->\n${tail}</${block.tag}>`
}

function sanitizeBundle(text: string): string {
  return text.replace(/<\/script/gi, '<\\/script')
}

function sanitizeCss(text: string): string {
  return text.replace(/<\/style/gi, '<\\/style')
}

function assetsBlock(css: string, js: string): string {
  let out = '<!--aha:assets-->\n'

  if (css.length > 0) {
    out += `<style data-aha-assets="css">\n${css}\n</style>\n`
  }

  if (js.length > 0) {
    out += `<script data-aha-assets="js">\n${js}\n</script>\n`
  }

  out += '<!--/aha:assets-->\n'

  return out
}

function insertAssets(source: string, css: string, js: string): string {
  if (css.length === 0 && js.length === 0) {
    return source
  }

  const block = assetsBlock(sanitizeCss(css), sanitizeBundle(js))
  const bodyClose = source.lastIndexOf('</body>')

  if (bodyClose !== -1) {
    return `${source.slice(0, bodyClose)}${block}${source.slice(bodyClose)}`
  }

  const htmlClose = source.lastIndexOf('</html>')

  if (htmlClose !== -1) {
    return `${source.slice(0, htmlClose)}${block}${source.slice(htmlClose)}`
  }

  return `${source}${block}`
}

export function buildPage(source: string): Effect.Effect<string, BuildError, ClientBundleStore> {
  return Effect.gen(function* () {
    const base = stripPageAssets(source)
    const tree = yield* renderBlockTree(base, 'aha', 0)
    const merged = tree.html

    if (tree.used.length === 0) {
      return merged
    }

    const store = yield* ClientBundleStore

    let css = ''
    let js = ''

    for (const name of tree.used) {
      const component = findCatalogComponent(name)

      if (component === null) {
        continue
      }

      css += `${component.css}\n`

      if (component.clientBundle !== null) {
        const bundle = yield* store.loadBundle(component.clientBundle)
        js += `${bundle}\n`
      }
    }

    return insertAssets(merged, css, js)
  })
}
