import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { AnnotatedCodeInput } from './annotated-code-schema.js'

/**
 * Annotated-code renderer. A code table with 1-based line numbers and
 * note markers beside a numbered note list. Markers and notes share
 * data-note indexes so the client highlights both directions.
 * Pure builders, no DOM.
 */

export interface AnnotatedCodeRenderOptions {
  readonly idPrefix: string
}

export function splitCodeLines(code: string): ReadonlyArray<string> {
  const parts = code.split('\n')

  if (parts.length > 0 && parts[parts.length - 1] === '') {
    return parts.slice(0, -1)
  }

  return parts
}

/** Zero-based note indexes referencing a 1-based code line, in note order. */
export function notesForLine(input: AnnotatedCodeInput, line: number): ReadonlyArray<number> {
  const out: Array<number> = []

  for (let index = 0; index < input.notes.length; index += 1) {
    const note = input.notes[index]

    if (note === undefined) {
      continue
    }

    for (const target of note.lines) {
      if (target === line) {
        out.push(index)
        break
      }
    }
  }

  return out
}

function renderMarkerCell(marks: ReadonlyArray<number>): string {
  if (marks.length === 0) {
    return '<td class="mk" aria-hidden="true"></td>'
  }

  let chips = ''

  for (const mark of marks) {
    chips += `<span class="chip">[${String(mark + 1)}]</span>`
  }

  return `<td class="mk" aria-hidden="true">${chips}</td>`
}

function noteToken(marks: ReadonlyArray<number>): string {
  let token = ''

  for (const mark of marks) {
    token += token.length === 0 ? String(mark) : ` ${String(mark)}`
  }

  return token
}

function renderCodeRows(input: AnnotatedCodeInput, lines: ReadonlyArray<string>): string {
  let rows = ''

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const lineNo = index + 1
    const marks = notesForLine(input, lineNo)
    const token = noteToken(marks)
    const notesAttr = token.length === 0 ? '' : ` data-notes="${token}"`

    rows += `<tr data-line="${String(lineNo)}"${notesAttr}><td class="no">${String(lineNo)}</td>${renderMarkerCell(marks)}<td class="code">${escapeHtml(line)}</td></tr>`
  }

  return rows
}

function lineRefText(lines: ReadonlyArray<number>): string {
  let out = ''

  for (const line of lines) {
    out += out.length === 0 ? String(line) : `, ${String(line)}`
  }

  return out
}

function lineToken(lines: ReadonlyArray<number>): string {
  let token = ''

  for (const line of lines) {
    token += token.length === 0 ? String(line) : ` ${String(line)}`
  }

  return token
}

function renderNotes(input: AnnotatedCodeInput): string {
  let items = ''

  for (let index = 0; index < input.notes.length; index += 1) {
    const note = input.notes[index]

    if (note === undefined) {
      continue
    }

    items += `<li data-note="${String(index)}" data-lines="${lineToken(note.lines)}" tabindex="0"><span class="nhead"><span class="n">[${String(index + 1)}]</span> <span class="nt">${escapeHtml(note.title)}</span> <span class="nl">lines ${escapeHtml(lineRefText(note.lines))}</span></span><p>${escapeHtml(note.text)}</p></li>`
  }

  return `<ol class="notes">${items}</ol>`
}

export function renderAnnotatedCode(
  input: AnnotatedCodeInput,
  options: AnnotatedCodeRenderOptions
): string {
  const lines = splitCodeLines(input.code)

  const filename =
    input.filename === undefined ? '' : `<span class="afile">${escapeHtml(input.filename)}</span>`

  const language =
    input.language === undefined ? '' : `<span class="alng">${escapeHtml(input.language)}</span>`

  const header =
    filename.length === 0 && language.length === 0
      ? ''
      : `<p class="ahead">${filename}${language}</p>`

  const label =
    input.filename === undefined ? 'Annotated code' : `Annotated code for ${input.filename}`

  return `<div class="aha-ancode" data-ancode="annotated-code" data-ancode-id="${escapeAttr(options.idPrefix)}">${header}<div class="abody"><div class="tw"><table aria-label="${escapeAttr(label)}">${renderCodeRows(input, lines)}</table></div>${renderNotes(input)}</div></div>`
}
