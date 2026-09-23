import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { CommandInput } from './command-schema.js'

/**
 * Command renderer. A prompt line with an unselectable glyph, an
 * optional working directory, a scrolling output block with separate
 * stdout and stderr lanes, and an exit badge. The copy button is
 * client-enhanced and stays inert without scripts.
 * Pure builders, no DOM.
 */

export interface CommandRenderOptions {
  readonly idPrefix: string
}

function renderOutput(input: CommandInput): string {
  if (input.output === undefined || input.output.length === 0) {
    return ''
  }

  let lines = ''

  for (const line of input.output) {
    if ((line.stderr ?? false) === true) {
      lines += `<p class="e"><span class="vh">stderr: </span><span class="mk" aria-hidden="true">!</span><span class="tx">${escapeHtml(line.text)}</span></p>`
      continue
    }

    lines += `<p class="o"><span class="mk" aria-hidden="true">›</span><span class="tx">${escapeHtml(line.text)}</span></p>`
  }

  return `<div class="out" tabindex="0" role="region" aria-label="Command output">${lines}</div>`
}

function renderExit(input: CommandInput): string {
  if (input.exitCode === undefined) {
    return ''
  }

  if (input.exitCode === 0) {
    return '<span class="exit ok">exit 0</span>'
  }

  return `<span class="exit bad">exit ${escapeHtml(String(input.exitCode))}</span>`
}

export function renderCommand(input: CommandInput, options: CommandRenderOptions): string {
  const cwd = input.cwd === undefined ? '' : `<span class="cwd">${escapeHtml(input.cwd)}</span>`

  return `<div class="aha-cmd" data-cmd="command" data-cmd-id="${escapeAttr(options.idPrefix)}"><div class="cmdline"><span class="prompt" aria-hidden="true">$</span>${cwd}<code class="cmd">${escapeHtml(input.command)}</code><button type="button" class="copy">copy</button>${renderExit(input)}</div>${renderOutput(input)}</div>`
}
