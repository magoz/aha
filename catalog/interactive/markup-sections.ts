/**
 * Section splitting for markup components whose children are labeled
 * sections (tabs, scenarios). Local to the interactive category: counts
 * nested section depth so prose sections inside an item do not end it
 * early. Plain string scanning, no DOM.
 */

export interface LabeledSection {
  readonly label: string
  readonly inner: string
}

function readSectionLabel(openTag: string, attribute: string): string | null {
  const pattern = new RegExp(`${attribute}\\s*=\\s*"([^"]*)"`)
  const match = pattern.exec(openTag)

  if (match === null) {
    return null
  }

  const value = match[1]

  if (value === undefined || value.length === 0) {
    return null
  }

  return value
}

function findTagEnd(html: string, from: number): number {
  let cursor = from
  let quoted: string | null = null

  while (cursor < html.length) {
    const char = html[cursor]

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

/** Split top-level sections carrying `attribute`, counting nested section
 * depth so prose sections inside an item do not end it early. */
export function splitLabeledSections(
  innerHtml: string,
  attribute: string
): ReadonlyArray<LabeledSection> {
  const out: Array<LabeledSection> = []
  let cursor = 0

  while (cursor < innerHtml.length) {
    const openAt = innerHtml.indexOf('<section', cursor)

    if (openAt === -1) {
      break
    }

    const openEnd = findTagEnd(innerHtml, openAt)

    if (openEnd === -1) {
      break
    }

    const openTag = innerHtml.slice(openAt, openEnd + 1)
    const label = readSectionLabel(openTag, attribute)

    if (label === null) {
      cursor = openEnd + 1
      continue
    }

    let depth = 1
    let scan = openEnd + 1
    let closeAt = -1

    while (scan < innerHtml.length && depth > 0) {
      const nextOpen = innerHtml.indexOf('<section', scan)
      const nextClose = innerHtml.indexOf('</section>', scan)

      if (nextClose === -1) {
        break
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1
        scan = nextOpen + 8
        continue
      }

      depth -= 1

      if (depth === 0) {
        closeAt = nextClose
      }

      scan = nextClose + 10
    }

    if (closeAt === -1) {
      break
    }

    out.push({ label, inner: innerHtml.slice(openEnd + 1, closeAt) })
    cursor = closeAt + 10
  }

  return out
}
