import type { MarkupAttribute } from './component.js'

/**
 * Byte-preserving block scan. Components live in elements carrying
 * `data-aha="name"`; everything outside those elements is never touched.
 * Pure functions; decoding and rendering happen in build.ts.
 */

export interface JsonBlock {
  readonly kind: 'json'
  readonly name: string
  readonly tag: string
  readonly start: number
  readonly end: number
  readonly openTag: string
  readonly inner: string
  readonly jsonText: string
  readonly scriptEnd: number
}

export interface MarkupBlock {
  readonly kind: 'markup'
  readonly name: string
  readonly tag: string
  readonly start: number
  readonly end: number
  readonly openTag: string
  readonly inner: string
  readonly attributes: ReadonlyArray<MarkupAttribute>
}

export type FoundBlock = JsonBlock | MarkupBlock

const BLOCK_TAGS: ReadonlyArray<string> = ['figure', 'aside', 'div', 'section']

function readTagName(source: string, at: number): string | null {
  let cursor = at + 1
  let name = ''

  while (cursor < source.length) {
    const char = source[cursor]

    if (char === undefined || char === ' ' || char === '\t' || char === '\n' || char === '>') {
      break
    }

    name += char
    cursor += 1
  }

  for (const tag of BLOCK_TAGS) {
    if (name === tag) {
      return tag
    }
  }

  return null
}

function findOpenTagEnd(source: string, at: number): number {
  let cursor = at
  let quoted: string | null = null

  while (cursor < source.length) {
    const char = source[cursor]

    if (char === undefined) {
      return -1
    }

    if (quoted !== null) {
      if (char === quoted) {
        quoted = null
      }

      cursor += 1
      continue
    }

    if (char === '"' || char === "'") {
      quoted = char
      cursor += 1
      continue
    }

    if (char === '>') {
      return cursor
    }

    cursor += 1
  }

  return -1
}

function readComponentName(openTag: string): string | null {
  const match = /data-aha\s*=\s*"([^"]+)"/.exec(openTag)

  if (match === null) {
    return null
  }

  const name = match[1]

  if (name === undefined || name.length === 0) {
    return null
  }

  return name
}

function findCloseTag(source: string, tag: string, from: number): number {
  const open = `<${tag}`
  const close = `</${tag}>`
  let cursor = from
  let depth = 1

  while (cursor < source.length) {
    const nextOpen = source.indexOf(open, cursor)
    const nextClose = source.indexOf(close, cursor)

    if (nextClose === -1) {
      return -1
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      cursor = nextOpen + open.length
      continue
    }

    depth -= 1

    if (depth === 0) {
      return nextClose
    }

    cursor = nextClose + close.length
  }

  return -1
}

function findJsonScript(inner: string): { readonly text: string; readonly end: number } | null {
  const open = /<script[^>]*type="application\/json"[^>]*>/.exec(inner)

  if (open === null || open.index === undefined) {
    return null
  }

  const contentStart = open.index + open[0].length
  const close = inner.indexOf('</script>', contentStart)

  if (close === -1) {
    return null
  }

  return { text: inner.slice(contentStart, close), end: close + '</script>'.length }
}

function readAttributes(openTag: string): ReadonlyArray<MarkupAttribute> {
  const out: Array<MarkupAttribute> = []
  const pattern = /([\w-]+)\s*=\s*"([^"]*)"/g
  let match: RegExpExecArray | null = pattern.exec(openTag)

  while (match !== null) {
    const name = match[1]
    const value = match[2]

    if (name !== undefined && value !== undefined) {
      out.push({ name, value })
    }

    match = pattern.exec(openTag)
  }

  return out
}

export function readBlockWidth(openTag: string): number | null {
  const match = /data-width\s*=\s*"(\d+)"/.exec(openTag)

  if (match === null) {
    return null
  }

  const raw = match[1]

  if (raw === undefined) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)

  if (!Number.isSafeInteger(parsed)) {
    return null
  }

  return Math.min(1200, Math.max(280, parsed))
}

export function findBlocks(source: string): ReadonlyArray<FoundBlock> {
  const out: Array<FoundBlock> = []
  let cursor = 0

  while (cursor < source.length) {
    const at = source.indexOf('<', cursor)

    if (at === -1) {
      break
    }

    if (source[at + 1] === '/') {
      cursor = at + 2
      continue
    }

    const tag = readTagName(source, at)

    if (tag === null) {
      cursor = at + 1
      continue
    }

    const openEnd = findOpenTagEnd(source, at)

    if (openEnd === -1) {
      break
    }

    const openTag = source.slice(at, openEnd + 1)
    const name = readComponentName(openTag)

    if (name === null) {
      cursor = openEnd + 1
      continue
    }

    const closeAt = findCloseTag(source, tag, openEnd + 1)

    if (closeAt === -1) {
      break
    }

    const end = closeAt + `</${tag}>`.length
    const inner = source.slice(openEnd + 1, closeAt)
    const script = findJsonScript(inner)

    if (script !== null) {
      out.push({
        kind: 'json',
        name,
        tag,
        start: at,
        end,
        openTag,
        inner,
        jsonText: script.text,
        scriptEnd: script.end
      })
    } else {
      out.push({
        kind: 'markup',
        name,
        tag,
        start: at,
        end,
        openTag,
        inner,
        attributes: readAttributes(openTag)
      })
    }

    cursor = end
  }

  return out
}

/** Remove previously generated render markers so rebuilds stay idempotent. */
export function stripGeneratedInner(inner: string): string {
  return inner.replace(/\n?<!--aha:render:.*?-->.*?<!--\/aha:render-->\n?/s, '')
}

export function stripPageAssets(source: string): string {
  return source.replace(/<!--aha:assets-->.*?<!--\/aha:assets-->\n?/s, '')
}

export function spliceBlocks(
  source: string,
  blocks: ReadonlyArray<FoundBlock>,
  rendered: ReadonlyArray<string>
): string {
  let out = ''
  let cursor = 0

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    const html = rendered[index]

    if (block === undefined || html === undefined) {
      continue
    }

    out += source.slice(cursor, block.start)
    out += html
    cursor = block.end
  }

  out += source.slice(cursor)

  return out
}
