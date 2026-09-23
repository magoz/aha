import { Effect } from 'effect'

import {
  findBlocks,
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
  index: number
): Effect.Effect<string, UnknownComponentError | BlockDecodeError> {
  return Effect.gen(function* () {
    const component = findCatalogComponent(block.name)

    if (component === null) {
      return yield* Effect.fail(new UnknownComponentError({ name: block.name }))
    }

    const idPrefix = `aha-${String(index)}-${component.name}`

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

      return replaceJsonInner(block, clean, rendered, component.name)
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

    return yield* component.renderMarkup({
      blockIndex: index,
      idPrefix,
      attributes: block.attributes,
      innerHtml: block.inner
    })
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

function usedComponentNames(blocks: ReadonlyArray<FoundBlock>): ReadonlyArray<string> {
  const out: Array<string> = []

  for (const block of blocks) {
    let seen = false

    for (const known of out) {
      if (known === block.name) {
        seen = true
        break
      }
    }

    if (!seen) {
      out.push(block.name)
    }
  }

  return out
}

export function buildPage(source: string): Effect.Effect<string, BuildError, ClientBundleStore> {
  return Effect.gen(function* () {
    const base = stripPageAssets(source)
    const blocks = findBlocks(base)

    const rendered = yield* Effect.forEach(blocks, (block, index) => renderFoundBlock(block, index))

    const merged = spliceBlocks(base, blocks, rendered)

    if (blocks.length === 0) {
      return merged
    }

    const used = usedComponentNames(blocks)
    const store = yield* ClientBundleStore

    let css = ''
    let js = ''

    for (const name of used) {
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
