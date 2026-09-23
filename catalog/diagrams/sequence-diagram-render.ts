import { measureLabel, wrapLabel } from './layout.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import type { SequenceDiagramInput } from './sequence-diagram-schema.js'

/**
 * Sequence-diagram renderer. Actors become lifelines across the top and
 * messages run top to bottom; lanes stretch to the container but never
 * below readability, and a horizontal scroll wrapper is the fallback when
 * actors truly cannot fit. Pure builders shared by Node and browser.
 */

export const SEQUENCE_DIAGRAM_WIDTH = 640

const PAD = 16

const HEAD_H = 34

const LANE_TOP = 42

const MSG_H = 52

const NOTE_H = 38

const MIN_LANE = 104

const ARROW_LEN = 9

export interface SequenceRenderOptions {
  readonly width: number
  readonly idPrefix: string
}

type RowKind = 'msg' | 'note'

interface PlacedRow {
  readonly kind: RowKind
  readonly index: number
  readonly y: number
}

function laneWidth(input: SequenceDiagramInput, span: number): number {
  let content = MIN_LANE

  for (const actor of input.actors) {
    const measured = measureLabel(actor.label)
    const need = measured.w + 40

    if (need > content) {
      content = need
    }
  }

  const stretched = (span - PAD * 2) / Math.max(1, input.actors.length)

  if (stretched > content) {
    return stretched
  }

  return content
}

function laneX(lane: number, actorIndex: number): number {
  return PAD + lane * (actorIndex + 0.5)
}

function buildRows(input: SequenceDiagramInput): ReadonlyArray<PlacedRow> {
  const rows: Array<PlacedRow> = []
  const notes = input.notes ?? []
  let y = LANE_TOP + 30

  for (let msg = 0; msg < input.messages.length; msg += 1) {
    rows.push({ kind: 'msg', index: msg, y })
    y += MSG_H

    for (let note = 0; note < notes.length; note += 1) {
      const entry = notes[note]

      if (entry !== undefined && (entry.after ?? input.messages.length) === msg + 1) {
        rows.push({ kind: 'note', index: note, y })
        y += NOTE_H
      }
    }
  }

  for (let note = 0; note < notes.length; note += 1) {
    const entry = notes[note]
    const after = entry?.after ?? input.messages.length

    if (entry !== undefined && after !== Math.floor(after)) {
      continue
    }

    if (
      after >= input.messages.length &&
      !rows.some((row) => row.kind === 'note' && row.index === note)
    ) {
      rows.push({ kind: 'note', index: note, y })
      y += NOTE_H
    }
  }

  return rows
}

function arrowHead(tipX: number, tipY: number, angle: number, open: boolean): string {
  const back = angle + Math.PI
  const spread = 0.42
  const leftX = tipX + ARROW_LEN * Math.cos(back - spread)
  const leftY = tipY + ARROW_LEN * Math.sin(back - spread)
  const rightX = tipX + ARROW_LEN * Math.cos(back + spread)
  const rightY = tipY + ARROW_LEN * Math.sin(back + spread)

  if (open) {
    return `<path class="ahead" d="M${coord(tipX)} ${coord(tipY)} L${coord(leftX)} ${coord(leftY)} M${coord(tipX)} ${coord(tipY)} L${coord(rightX)} ${coord(rightY)}"/>`
  }

  return `<polygon points="${coord(tipX)},${coord(tipY)} ${coord(leftX)},${coord(leftY)} ${coord(rightX)},${coord(rightY)}"/>`
}

function messageLabel(label: string, number: number, midX: number, lineY: number): string {
  const lines = wrapLabel(`${String(number)}. ${label}`, 30)
  let out = ''

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const y = lines.length === 1 ? lineY - 8 : lineY - 20 + index * 13
    const cls = index === 0 ? 'mlbl' : 'mlbl cont'
    out += `<text x="${coord(midX)}" y="${coord(y)}" text-anchor="middle" class="${cls}">${escapeHtml(line)}</text>`
  }

  return out
}

export function renderSequenceDiagram(
  input: SequenceDiagramInput,
  options: SequenceRenderOptions
): string {
  const span = Math.max(300, options.width)
  const lane = laneWidth(input, span)
  const totalW = PAD * 2 + lane * input.actors.length
  const rows = buildRows(input)

  let bodyBottom = LANE_TOP + 30

  for (const row of rows) {
    const bottom = row.kind === 'msg' ? row.y + MSG_H - 12 : row.y + NOTE_H - 8

    if (bottom > bodyBottom) {
      bodyBottom = bottom
    }
  }

  const height = bodyBottom + 16
  const actorIndex = new Map<string, number>()

  for (let index = 0; index < input.actors.length; index += 1) {
    const actor = input.actors[index]

    if (actor !== undefined) {
      actorIndex.set(actor.id, index)
    }
  }

  let svg = `<svg viewBox="0 0 ${coord(totalW)} ${coord(height)}" role="presentation" data-span="${coord(span)}"${totalW > span ? ` style="min-width: ${coord(totalW)}px"` : ''}>`

  for (let index = 0; index < input.actors.length; index += 1) {
    const actor = input.actors[index]

    if (actor === undefined) {
      continue
    }

    const cx = laneX(lane, index)
    const measured = measureLabel(actor.label)
    const w = Math.min(lane - 16, measured.w)
    svg += `<line x1="${coord(cx)}" y1="${coord(LANE_TOP)}" x2="${coord(cx)}" y2="${coord(bodyBottom)}" class="lane"/>`
    svg += `<g class="node actor" data-node="${escapeAttr(actor.id)}" tabindex="0" role="button" aria-label="actor ${escapeAttr(actor.label)}">`
    svg += `<rect x="${coord(cx - w / 2)}" y="8" width="${coord(w)}" height="${HEAD_H}" class="nrect"/>`
    svg += `<text x="${coord(cx)}" y="${coord(8 + HEAD_H / 2 + 4)}" text-anchor="middle" class="ntext">${escapeHtml(actor.label)}</text></g>`
  }

  for (const row of rows) {
    if (row.kind === 'note') {
      const note = input.notes?.[row.index]

      if (note === undefined) {
        continue
      }

      const at = note.actor === undefined ? null : actorIndex.get(note.actor)
      const textW = note.text.length * 6.6 + 28
      const w = Math.min(totalW - PAD * 2, Math.max(120, textW))
      const center = at === undefined || at === null ? totalW / 2 : laneX(lane, at)
      const x = Math.min(Math.max(PAD, center - w / 2), totalW - PAD - w)
      svg += `<g class="snote"><rect x="${coord(x)}" y="${coord(row.y)}" width="${coord(w)}" height="30"/>`
      svg += `<text x="${coord(x + w / 2)}" y="${coord(row.y + 19)}" text-anchor="middle" class="ntext">${escapeHtml(note.text)}</text></g>`
      continue
    }

    const message = input.messages[row.index]

    if (message === undefined) {
      continue
    }

    const fromX = laneX(lane, actorIndex.get(message.from) ?? 0)
    const toX = laneX(lane, actorIndex.get(message.to) ?? 0)
    const lineY = row.y + 24
    const hi = message.highlight ?? false
    const cls = hi ? 'edge msg hi' : 'edge msg'
    const kind = message.kind ?? 'sync'
    const lineCls = kind === 'return' ? 'mline ret' : 'mline'
    const number = row.index + 1
    const aria = `message ${String(number)}: ${message.from} to ${message.to}: ${message.label}`
    svg += `<g class="${cls}" data-edge="" data-from="${escapeAttr(message.from)}" data-to="${escapeAttr(message.to)}" tabindex="0" role="button" aria-label="${escapeAttr(aria)}">`

    if (message.from === message.to) {
      const endX = fromX + 30
      svg += messageLabel(message.label, number, endX + 4, lineY - 6)
      svg += `<path class="${lineCls}" d="M${coord(fromX)} ${coord(lineY)} H${coord(endX)} V${coord(lineY + 20)} H${coord(fromX + ARROW_LEN)}"/>`
      svg += arrowHead(fromX, lineY + 20, Math.PI, kind !== 'sync')
    } else {
      const leftToRight = toX > fromX
      const tipX = toX
      const endX = leftToRight ? toX - ARROW_LEN : toX + ARROW_LEN
      const angle = leftToRight ? 0 : Math.PI
      svg += messageLabel(message.label, number, (fromX + toX) / 2, lineY)
      svg += `<path class="${lineCls}" d="M${coord(fromX)} ${coord(lineY)} H${coord(endX)}"/>`
      svg += arrowHead(tipX, lineY, angle, kind !== 'sync')
    }

    svg += '</g>'
  }

  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Messages in order</summary><div class="aha-scroll"><table><thead><tr><th>#</th><th>from</th><th>to</th><th>message</th></tr></thead><tbody>'

  for (let index = 0; index < input.messages.length; index += 1) {
    const message = input.messages[index]

    if (message === undefined) {
      continue
    }

    table += `<tr><td>${String(index + 1)}</td><td>${escapeHtml(message.from)}</td><td>${escapeHtml(message.to)}</td><td>${escapeHtml(message.label)}</td></tr>`
  }

  table += '</tbody></table></div></details>'

  const names: Array<string> = []

  for (const actor of input.actors) {
    names.push(actor.label)
  }

  const aria =
    input.title === undefined
      ? `Sequence diagram: ${names.join(', ')}`
      : `${input.title}: ${names.join(', ')}`

  const title = input.title === undefined ? '' : `<p class="dtitle">${escapeHtml(input.title)}</p>`

  return `<div class="aha-diagram aha-sequence" data-diagram="sequence-diagram" data-diagram-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}<div class="swrap">${svg}</div>${table}</div>`
}
