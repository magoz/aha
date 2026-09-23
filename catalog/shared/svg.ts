/**
 * Minimal SVG and HTML string builders. Everything is escaped at the
 * boundary; these helpers never touch the DOM.
 */

export function escapeHtml(value: string): string {
  let out = ''

  for (const char of value) {
    if (char === '&') {
      out += '&amp;'
      continue
    }

    if (char === '<') {
      out += '&lt;'
      continue
    }

    if (char === '>') {
      out += '&gt;'
      continue
    }

    if (char === '"') {
      out += '&quot;'
      continue
    }

    out += char
  }

  return out
}

export function escapeAttr(value: string): string {
  return escapeHtml(value)
}

/** Round coordinates to two decimals so output stays compact and stable. */
export function coord(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  const rounded = Math.round(value * 100) / 100

  if (rounded === 0) {
    return '0'
  }

  return String(rounded)
}

export interface PlotPoint {
  readonly x: number
  readonly y: number
}

export function linePath(points: ReadonlyArray<PlotPoint>): string {
  let path = ''

  for (const point of points) {
    if (path.length === 0) {
      path = `M${coord(point.x)} ${coord(point.y)}`
      continue
    }

    path += ` L${coord(point.x)} ${coord(point.y)}`
  }

  return path
}

export function bandPath(top: ReadonlyArray<PlotPoint>, bottom: ReadonlyArray<PlotPoint>): string {
  let path = linePath(top)

  for (let index = bottom.length - 1; index >= 0; index -= 1) {
    const point = bottom[index]

    if (point === undefined) {
      continue
    }

    path += ` L${coord(point.x)} ${coord(point.y)}`
  }

  return `${path} Z`
}

/** Marker glyph per series index so series differ by more than ink shade. */
export function markerForSeries(index: number): string {
  const slot = ((index % 4) + 4) % 4

  if (slot === 1) {
    return 'square'
  }

  if (slot === 2) {
    return 'triangle'
  }

  if (slot === 3) {
    return 'diamond'
  }

  return 'circle'
}

/** Dash pattern per series index; the highlighted series stays solid. */
export function dashForSeries(index: number, highlighted: boolean): string | null {
  if (highlighted) {
    return null
  }

  const slot = ((index % 4) + 4) % 4

  if (slot === 1) {
    return '6 3'
  }

  if (slot === 2) {
    return '2 2'
  }

  if (slot === 3) {
    return '8 3 2 3'
  }

  return null
}

export function markerGlyph(kind: string, cx: number, cy: number, size: number): string {
  if (kind === 'square') {
    const half = size / 2

    return `<rect x="${coord(cx - half)}" y="${coord(cy - half)}" width="${coord(size)}" height="${coord(size)}" class="mk"/>`
  }

  if (kind === 'triangle') {
    const half = size / 2

    return `<path d="M${coord(cx)} ${coord(cy - half)} L${coord(cx + half)} ${coord(cy + half)} L${coord(cx - half)} ${coord(cy + half)} Z" class="mk"/>`
  }

  if (kind === 'diamond') {
    const half = size / 2

    return `<path d="M${coord(cx)} ${coord(cy - half)} L${coord(cx + half)} ${coord(cy)} L${coord(cx)} ${coord(cy + half)} L${coord(cx - half)} ${coord(cy)} Z" class="mk"/>`
  }

  return `<circle cx="${coord(cx)}" cy="${coord(cy)}" r="${coord(size / 2)}" class="mk"/>`
}
