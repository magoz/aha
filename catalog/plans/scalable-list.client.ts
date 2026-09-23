import { formatScaled, roundScaled } from './scalable-list-render.js'

/**
 * Scalable-list browser client. Unhides the yield control and rescales
 * every quantity live with the renderer's rounding rules. Without
 * scripts the list stays at the base yield. No Effect or Schema here.
 */

function readNumberAttr(element: HTMLElement, name: string): number | null {
  const raw = element.getAttribute(name)

  if (raw === null || raw.length === 0) {
    return null
  }

  const parsed = Number.parseFloat(raw)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function rescale(root: HTMLElement, current: number): void {
  const base = readNumberAttr(root, 'data-serves')
  const label = root.getAttribute('data-label') ?? 'servings'

  if (base === null || base <= 0) {
    return
  }

  const spans = root.querySelectorAll('.sc-items .q[data-base]')

  for (let index = 0; index < spans.length; index += 1) {
    const node = spans.item(index)

    if (!(node instanceof HTMLElement)) {
      continue
    }

    const baseQty = readNumberAttr(node, 'data-base')
    const unit = node.getAttribute('data-unit') ?? ''
    const whole = node.getAttribute('data-whole') === '1'

    if (baseQty === null) {
      continue
    }

    const scaled = roundScaled((baseQty * current) / base, unit, whole)
    const text = formatScaled(scaled)
    node.textContent = unit.length === 0 ? text : `${text} ${unit}`
  }

  const currentLabel = root.querySelector('.sc-yield .sc-cur')

  if (currentLabel !== null) {
    currentLabel.textContent = `${String(current)} ${label}`
  }

  const echoed = root.querySelector('.sc-ctl output')

  if (echoed !== null) {
    echoed.textContent = `Serves ${String(current)} ${label}`
  }
}

function clampServes(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(64, Math.max(1, Math.round(value)))
}

function initScale(root: HTMLElement): void {
  if (root.classList.contains('is-live')) {
    return
  }

  const control = root.querySelector('.sc-ctl')

  if (!(control instanceof HTMLElement)) {
    return
  }

  const base = readNumberAttr(root, 'data-serves')

  if (base === null || base <= 0) {
    return
  }

  let current = clampServes(base)
  root.classList.add('is-live')
  control.removeAttribute('hidden')

  const buttons = control.querySelectorAll('button')

  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons.item(index)

    if (!(button instanceof HTMLElement)) {
      continue
    }

    const step = readNumberAttr(button, 'data-step')
    const preset = readNumberAttr(button, 'data-set')

    if (step !== null) {
      const delta = step
      button.addEventListener('click', () => {
        current = clampServes(current + delta)
        rescale(root, current)
      })
      continue
    }

    if (preset !== null) {
      const target = preset
      button.addEventListener('click', () => {
        current = clampServes(target)
        rescale(root, current)
      })
    }
  }
}

function initAllScales(): void {
  const roots = document.querySelectorAll('.aha-scale[data-scale-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      initScale(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllScales)
} else {
  initAllScales()
}
