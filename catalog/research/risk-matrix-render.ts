import { escapeAttr, escapeHtml } from '../shared/svg.js'
import type { Risk, RiskLevel, RiskMatrixInput } from './risk-matrix-schema.js'

/**
 * Risk-matrix renderer. A 5-by-5 likelihood/impact grid with numbered
 * markers plus a list carrying the full text, mitigation and owner.
 * Markers and rows share a data index so the client can highlight them
 * together. Pure builders, no DOM.
 */

export interface RiskMatrixRenderOptions {
  readonly idPrefix: string
}

export function levelScore(level: RiskLevel): number | null {
  if (level === 'low') {
    return 1
  }

  if (level === 'medium' || level === 'med') {
    return 3
  }

  if (level === 'high') {
    return 5
  }

  if (!Number.isInteger(level) || level < 1 || level > 5) {
    return null
  }

  return level
}

function renderGrid(risks: ReadonlyArray<Risk>, scores: ReadonlyArray<number>): string {
  let head = '<div class="rm-corner" aria-hidden="true"></div>'

  for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
    head += `<div class="rm-ax" aria-hidden="true">L${String(likelihood)}</div>`
  }

  let cells = ''

  for (let impact = 5; impact >= 1; impact -= 1) {
    cells += `<div class="rm-ax" aria-hidden="true">I${String(impact)}</div>`

    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      let marks = ''

      for (let index = 0; index < risks.length; index += 1) {
        const score = scores[index]

        if (score === undefined) {
          continue
        }

        const likelihoodScore = Math.floor(score / 10)
        const impactScore = score - likelihoodScore * 10

        if (likelihoodScore === likelihood && impactScore === impact) {
          const risk = risks[index]

          const label =
            risk === undefined
              ? ''
              : ` aria-label="Risk ${String(index + 1)}: ${escapeAttr(risk.title)}"`

          marks += `<span class="mk" tabindex="0" data-mk="${String(index)}"${label}>${String(index + 1)}</span>`
        }
      }

      cells += `<div class="rm-cell">${marks}</div>`
    }
  }

  return `<div class="rm-grid" role="img" aria-label="Risk grid: columns likelihood 1 to 5, rows impact 5 to 1. See the list below for each numbered risk.">${head}${cells}</div><p class="rm-axes"><span>likelihood →</span><span>impact ↑</span></p>`
}

function renderList(
  idPrefix: string,
  risks: ReadonlyArray<Risk>,
  scores: ReadonlyArray<number>
): string {
  let items = ''

  for (let index = 0; index < risks.length; index += 1) {
    const risk = risks[index]
    const score = scores[index]

    if (risk === undefined || score === undefined) {
      continue
    }

    const likelihoodScore = Math.floor(score / 10)
    const impactScore = score - likelihoodScore * 10

    if (likelihoodScore < 1 || impactScore < 1) {
      continue
    }

    const mitigation =
      risk.mitigation === undefined || risk.mitigation.trim().length === 0
        ? ''
        : `<p class="r-mit"><span class="k">Mitigation</span>${escapeHtml(risk.mitigation.trim())}</p>`

    const owner =
      risk.owner === undefined || risk.owner.trim().length === 0
        ? ''
        : `<p class="r-own"><span class="k">Owner</span>${escapeHtml(risk.owner.trim())}</p>`

    items += `<li id="${escapeAttr(`${idPrefix}-r${String(index)}`)}" data-row="${String(index)}" tabindex="0"><p class="r-t"><span class="n">${String(index + 1)}.</span> ${escapeHtml(risk.title)}</p><p class="r-score">likelihood ${String(likelihoodScore)} · impact ${String(impactScore)}</p>${mitigation}${owner}</li>`
  }

  return `<ol class="risk-list">${items}</ol>`
}

export function renderRiskMatrix(input: RiskMatrixInput, options: RiskMatrixRenderOptions): string {
  const scores: Array<number> = []

  for (const risk of input.risks) {
    const likelihood = levelScore(risk.likelihood) ?? 0
    const impact = levelScore(risk.impact) ?? 0
    scores.push(likelihood * 10 + impact)
  }

  const title =
    input.title === undefined ? '' : `<p class="aha-title">${escapeHtml(input.title)}</p>`

  return `<div class="aha-risk" data-risk="risk-matrix" data-risk-id="${escapeAttr(options.idPrefix)}">${title}${renderGrid(input.risks, scores)}${renderList(options.idPrefix, input.risks, scores)}</div>`
}
