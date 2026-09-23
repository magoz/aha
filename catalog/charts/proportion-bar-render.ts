import { tooltipShell } from '../shared/chart-frame.js'
import type { ChartStop } from '../shared/chart-client.js'
import { coord, escapeAttr, escapeHtml } from '../shared/svg.js'
import type { ProportionBarInput } from './proportion-bar-schema.js'

/**
 * Proportion-bar renderer. One 100% bar or a small set of them showing
 * parts of a whole, labelled directly: a stand-in for pie charts. Pure
 * builders shared by the Node build and the browser client.
 */

export const PROPORTION_BAR_WIDTH = 640

const BAR_HEIGHT = 40

const BAR_GAP = 44

function segmentClass(index: number, highlight: boolean, muted: boolean): string {
  if (highlight) {
    return 'seg hi'
  }

  if (muted) {
    return `seg cat-${String(index % 6)}`
  }

  return `seg s-${String(index % 4)}`
}

function formatShare(share: number): string {
  const percent = share * 100
  const rounded = Math.round(percent * 10) / 10

  return `${Number.isInteger(rounded) ? String(rounded) : String(rounded)}%`
}

function estimateTextWidth(text: string): number {
  return text.length * 6.5 + 8
}

interface PlacedSegment {
  readonly bar: number
  readonly part: number
  readonly x: number
  readonly w: number
  readonly share: number
}

export function renderProportionBar(
  input: ProportionBarInput,
  options: ProportionWidthOptions
): string {
  if (input.bars.length === 0) {
    return `<div class="aha-chart" data-chart-id="${escapeAttr(options.idPrefix)}"><p class="aha-title">No data</p></div>`
  }

  const muted = (input.palette ?? 'mono') === 'muted'
  const width = Math.max(280, options.width)
  const plotX = 8
  const plotW = width - 16

  let aboveCount = 0
  let belowCount = 0
  const segments: Array<PlacedSegment> = []

  for (let bar = 0; bar < input.bars.length; bar += 1) {
    const row = input.bars[bar]

    if (row === undefined) {
      continue
    }

    let total = 0

    for (const part of row.parts) {
      if (part.value > 0) {
        total += part.value
      }
    }

    if (total <= 0) {
      continue
    }

    let cursor = plotX

    for (let part = 0; part < row.parts.length; part += 1) {
      const entry = row.parts[part]

      if (entry === undefined || entry.value <= 0) {
        continue
      }

      const share = entry.value / total
      const w = plotW * share
      const caption = `${entry.name} ${formatShare(share)}`

      if (w < estimateTextWidth(caption)) {
        const slot = aboveCount <= belowCount ? 'above' : 'below'

        if (slot === 'above') {
          aboveCount += 1
        } else {
          belowCount += 1
        }
      }

      segments.push({ bar, part, x: cursor, w, share })
      cursor += w
    }
  }

  const topPad = aboveCount > 0 ? 26 : 10
  const bottomPad = belowCount > 0 ? 28 : 10

  const height =
    topPad + input.bars.length * BAR_HEIGHT + (input.bars.length - 1) * BAR_GAP + bottomPad

  let svg = `<svg viewBox="0 0 ${String(width)} ${String(height)}" role="presentation">`
  let aboveUsed = 0
  let belowUsed = 0

  for (const segment of segments) {
    const row = input.bars[segment.bar]

    if (row === undefined) {
      continue
    }

    const entry = row.parts[segment.part]

    if (entry === undefined) {
      continue
    }

    const y = topPad + segment.bar * (BAR_HEIGHT + BAR_GAP)
    const cls = segmentClass(segment.part, entry.highlight ?? false, muted)
    const stop = segments.indexOf(segment)
    const caption = `${entry.name} ${formatShare(segment.share)}`
    svg += `<rect x="${coord(segment.x)}" y="${coord(y)}" width="${coord(Math.max(1, segment.w - 1.5))}" height="${coord(BAR_HEIGHT)}" class="${cls}" data-stop="${String(stop)}" data-series="${String(segment.part)}"><title>${escapeAttr(`${row.label === undefined ? '' : `${row.label} · `}${entry.name}: ${formatShare(segment.share)}`)}</title></rect>`

    if (segment.w >= estimateTextWidth(caption)) {
      svg += `<text x="${coord(segment.x + segment.w / 2)}" y="${coord(y + BAR_HEIGHT / 2 + 4)}" text-anchor="middle" class="plab inv">${escapeHtml(caption)}</text>`
      continue
    }

    // Outside labels stay inside the chart: clamp their centre so neither end spills.
    const halfLabel = estimateTextWidth(caption) / 2
    const centerX = Math.min(Math.max(segment.x + segment.w / 2, halfLabel), width - halfLabel)
    const tickX = segment.x + segment.w / 2

    if (aboveUsed <= belowUsed && aboveCount > 0) {
      svg += `<line x1="${coord(tickX)}" y1="${coord(y)}" x2="${coord(tickX)}" y2="${coord(y - 6)}" class="tick-line"/>`
      svg += `<text x="${coord(centerX)}" y="${coord(y - 10)}" text-anchor="middle" class="plab">${escapeHtml(caption)}</text>`
      aboveUsed += 1
    } else {
      svg += `<line x1="${coord(tickX)}" y1="${coord(y + BAR_HEIGHT)}" x2="${coord(tickX)}" y2="${coord(y + BAR_HEIGHT + 6)}" class="tick-line"/>`
      svg += `<text x="${coord(centerX)}" y="${coord(y + BAR_HEIGHT + 20)}" text-anchor="middle" class="plab">${escapeHtml(caption)}</text>`
      belowUsed += 1
    }
  }

  for (let bar = 0; bar < input.bars.length; bar += 1) {
    const row = input.bars[bar]

    if (row === undefined || row.label === undefined) {
      continue
    }

    const y = topPad + bar * (BAR_HEIGHT + BAR_GAP)
    svg += `<text x="${coord(plotX)}" y="${coord(y - 6)}" text-anchor="start" class="tick">${escapeHtml(row.label)}</text>`
  }

  svg += '</svg>'

  let table =
    '<details class="aha-values"><summary>Exact values</summary><div class="aha-scroll"><table><thead><tr><th>bar</th><th>part</th><th class="num">share</th></tr></thead><tbody>'

  for (let bar = 0; bar < input.bars.length; bar += 1) {
    const row = input.bars[bar]

    if (row === undefined) {
      continue
    }

    let total = 0

    for (const part of row.parts) {
      if (part.value > 0) {
        total += part.value
      }
    }

    for (const part of row.parts) {
      const share = total > 0 && part.value > 0 ? formatShare(part.value / total) : '—'
      table += `<tr><td>${escapeHtml(row.label ?? `bar ${String(bar + 1)}`)}</td><td>${escapeHtml(part.name)}</td><td class="num">${escapeHtml(share)}</td></tr>`
    }
  }

  table += '</tbody></table></div></details>'

  const aria = input.title === undefined ? 'Proportion bar' : input.title

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-chart aha-prop" data-chart="proportion-bar" data-chart-id="${escapeAttr(options.idPrefix)}" tabindex="0" role="img" aria-label="${escapeAttr(aria)}">${title}${svg}${tooltipShell()}${table}</div>`
}

export interface ProportionWidthOptions {
  readonly width: number
  readonly idPrefix: string
}

/** Client stops for the shared interaction kit: one stop per segment. */
export function proportionBarStops(
  input: ProportionBarInput,
  width: number
): ReadonlyArray<ChartStop> {
  const safeWidth = Math.max(280, width)
  const plotX = 8
  const plotW = safeWidth - 16
  const out: Array<ChartStop> = []

  for (let bar = 0; bar < input.bars.length; bar += 1) {
    const row = input.bars[bar]

    if (row === undefined) {
      continue
    }

    let total = 0

    for (const part of row.parts) {
      if (part.value > 0) {
        total += part.value
      }
    }

    if (total <= 0) {
      continue
    }

    let cursor = plotX

    for (const part of row.parts) {
      if (part.value <= 0) {
        continue
      }

      const share = part.value / total
      const w = plotW * share
      const head = row.label === undefined ? part.name : `${row.label} · ${part.name}`
      out.push({
        x: cursor + w / 2,
        y: 30 + bar * (BAR_HEIGHT + BAR_GAP),
        html: `<b>${escapeHtml(head)}</b><div><span class="hv">${escapeHtml(formatShare(share))}</span></div>`
      })
      cursor += w
    }
  }

  return out
}
