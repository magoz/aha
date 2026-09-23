import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { CodeDiffInput } from './code-diff-schema.js'

/**
 * Code-diff renderer. Walks unified diff lines, numbers both sides from
 * the hunk headers, and marks every row with a +/- glyph so meaning never
 * depends on colour. Pure builders, no DOM.
 */

export interface CodeDiffRenderOptions {
  readonly idPrefix: string
}

type DiffKind = 'add' | 'del' | 'ctx' | 'hunk' | 'meta'

interface DiffLine {
  readonly kind: DiffKind
  readonly marker: string
  readonly text: string
  readonly oldNo: number | null
  readonly newNo: number | null
}

function classifyLine(line: string): DiffKind {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return 'add'
  }

  if (line.startsWith('-') && !line.startsWith('---')) {
    return 'del'
  }

  if (line.startsWith('@@')) {
    return 'hunk'
  }

  if (line.startsWith('\\')) {
    return 'meta'
  }

  return 'ctx'
}

function markerFor(kind: DiffKind, line: string): string {
  if (kind === 'add') {
    return '+'
  }

  if (kind === 'del') {
    return '-'
  }

  if (kind === 'hunk') {
    return '@'
  }

  if (line.startsWith('\\')) {
    return '\\'
  }

  return ' '
}

function parseHunkStart(line: string): { readonly old: number; readonly next: number } | null {
  const match = /@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line)

  if (match === null) {
    return null
  }

  const oldRaw = match[1]
  const nextRaw = match[2]

  if (oldRaw === undefined || nextRaw === undefined) {
    return null
  }

  const old = Number.parseInt(oldRaw, 10)
  const next = Number.parseInt(nextRaw, 10)

  if (!Number.isSafeInteger(old) || !Number.isSafeInteger(next)) {
    return null
  }

  return { old, next }
}

function splitLines(diff: string): ReadonlyArray<string> {
  const parts = diff.split('\n')

  if (parts.length > 0 && parts[parts.length - 1] === '') {
    return parts.slice(0, -1)
  }

  return parts
}

export function parseDiffLines(diff: string): ReadonlyArray<DiffLine> {
  const out: Array<DiffLine> = []
  let oldNo = 1
  let newNo = 1
  let numbered = false

  for (const raw of splitLines(diff)) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    const kind = classifyLine(line)

    if (kind === 'hunk') {
      const start = parseHunkStart(line)

      if (start !== null) {
        oldNo = start.old
        newNo = start.next
        numbered = true
      }

      out.push({ kind, marker: markerFor(kind, line), text: line, oldNo: null, newNo: null })
      continue
    }

    if (kind === 'meta') {
      out.push({ kind, marker: markerFor(kind, line), text: line, oldNo: null, newNo: null })
      continue
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      out.push({ kind: 'meta', marker: ' ', text: line, oldNo: null, newNo: null })
      continue
    }

    if (!numbered) {
      out.push({ kind, marker: markerFor(kind, line), text: line, oldNo: null, newNo: null })
      continue
    }

    if (kind === 'add') {
      out.push({ kind, marker: '+', text: line.slice(1), oldNo: null, newNo })
      newNo += 1
      continue
    }

    if (kind === 'del') {
      out.push({ kind, marker: '-', text: line.slice(1), oldNo, newNo: null })
      oldNo += 1
      continue
    }

    out.push({ kind, marker: ' ', text: line.startsWith(' ') ? line.slice(1) : line, oldNo, newNo })
    oldNo += 1
    newNo += 1
  }

  return out
}

function rowClass(kind: DiffKind): string {
  if (kind === 'add') {
    return ' class="add"'
  }

  if (kind === 'del') {
    return ' class="del"'
  }

  if (kind === 'hunk') {
    return ' class="hunk"'
  }

  if (kind === 'meta') {
    return ' class="meta"'
  }

  return ''
}

function renderRow(line: DiffLine): string {
  const oldCell = line.oldNo === null ? '' : String(line.oldNo)
  const newCell = line.newNo === null ? '' : String(line.newNo)

  return `<tr${rowClass(line.kind)}><td class="no">${oldCell}</td><td class="no">${newCell}</td><td class="mk" aria-hidden="true">${escapeHtml(line.marker)}</td><td class="code">${escapeHtml(line.text)}</td></tr>`
}

export function renderCodeDiff(input: CodeDiffInput, options: CodeDiffRenderOptions): string {
  const lines = parseDiffLines(input.diff)
  let rows = ''

  for (const line of lines) {
    rows += renderRow(line)
  }

  const header =
    input.file === undefined ? '' : `<p class="diff-file">${escapeHtml(input.file)}</p>`

  return `<div class="aha-diff" data-diff="code-diff" data-diff-id="${escapeAttr(options.idPrefix)}">${header}<div class="tw"><table aria-label="Unified diff${input.file === undefined ? '' : ` for ${escapeAttr(input.file)}`}">${rows}</table></div></div>`
}
