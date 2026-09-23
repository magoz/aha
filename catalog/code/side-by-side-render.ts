import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { SideBySideInput, SidePane } from './side-by-side-schema.js'

/**
 * Side-by-side renderer. Two labelled panes holding text or code, side
 * by side on wide containers and stacked on narrow ones. Code panes
 * show line numbers; changed lines carry a marker glyph plus a hidden
 * word, never colour alone. Authors supply both sides; there is no
 * diffing. Pure builders, no DOM.
 */

export interface SideBySideRenderOptions {
  readonly idPrefix: string
}

export function splitPaneLines(text: string): ReadonlyArray<string> {
  const parts = text.split('\n')

  if (parts.length > 0 && parts[parts.length - 1] === '') {
    return parts.slice(0, -1)
  }

  return parts
}

function isChanged(pane: SidePane, lineNo: number): boolean {
  if (pane.changedLines === undefined) {
    return false
  }

  for (const changed of pane.changedLines) {
    if (changed === lineNo) {
      return true
    }
  }

  return false
}

function renderCodePane(pane: SidePane): string {
  const lines = splitPaneLines(pane.text)
  let rows = ''

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const lineNo = index + 1

    if (isChanged(pane, lineNo)) {
      rows += `<tr class="chg"><td class="no">${String(lineNo)}</td><td class="mk"><span aria-hidden="true">*</span><span class="vh">changed: </span></td><td class="code">${escapeHtml(line)}</td></tr>`
      continue
    }

    rows += `<tr><td class="no">${String(lineNo)}</td><td class="mk" aria-hidden="true"></td><td class="code">${escapeHtml(line)}</td></tr>`
  }

  return `<div class="tw"><table aria-label="${escapeAttr(pane.label)} code">${rows}</table></div>`
}

function renderTextPane(pane: SidePane): string {
  return `<div class="tx">${escapeHtml(pane.text)}</div>`
}

function renderPane(pane: SidePane, side: string): string {
  const kind = pane.language === undefined ? 'text' : 'code'

  const language =
    pane.language === undefined ? '' : `<span class="lg">${escapeHtml(pane.language)}</span>`

  const body = kind === 'code' ? renderCodePane(pane) : renderTextPane(pane)

  return `<section class="pane ${kind}" aria-label="${escapeAttr(pane.label)} ${side} pane"><p class="ph"><span class="pl">${escapeHtml(pane.label)}</span>${language}</p>${body}</section>`
}

export function renderSideBySide(input: SideBySideInput, options: SideBySideRenderOptions): string {
  return `<div class="aha-sbs" data-sbs="side-by-side" data-sbs-id="${escapeAttr(options.idPrefix)}"><div class="panes">${renderPane(input.left, 'left')}${renderPane(input.right, 'right')}</div></div>`
}
