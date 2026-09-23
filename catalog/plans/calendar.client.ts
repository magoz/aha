/**
 * Calendar browser client. Event details live inside grid cells and the
 * week strip's scroll box, both of which clip overflow, so with scripts on
 * the details are shown in one floating tip positioned on the calendar
 * root and clamped inside it. The CSS-only popover remains the no-script
 * fallback. No Effect or Schema here.
 */

const GAP = 6

const EDGE = 4

function eventFor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null
  }

  const found = target.closest('.ev')

  return found instanceof HTMLElement ? found : null
}

function detailText(event: HTMLElement): string {
  const detail = event.querySelector('.ev-d')

  return detail === null ? '' : (detail.textContent ?? '')
}

function place(root: HTMLElement, tip: HTMLElement, event: HTMLElement): void {
  const text = detailText(event)

  if (text.length === 0) {
    tip.hidden = true

    return
  }

  tip.textContent = text
  tip.hidden = false

  const rootBox = root.getBoundingClientRect()
  const eventBox = event.getBoundingClientRect()
  const width = tip.offsetWidth
  const height = tip.offsetHeight
  let left = eventBox.left - rootBox.left
  let top = eventBox.bottom - rootBox.top + GAP

  if (left + width > rootBox.width - EDGE) {
    left = rootBox.width - EDGE - width
  }

  if (left < EDGE) {
    left = EDGE
  }

  if (top + height > rootBox.height && eventBox.top - rootBox.top - GAP - height >= 0) {
    top = eventBox.top - rootBox.top - GAP - height
  }

  tip.style.left = `${String(Math.round(left))}px`
  tip.style.top = `${String(Math.round(top))}px`
}

function initCalendar(root: HTMLElement): void {
  const tip = document.createElement('div')

  tip.className = 'cal-tip'
  tip.hidden = true
  tip.setAttribute('aria-hidden', 'true')
  root.appendChild(tip)
  root.classList.add('js')

  const show = (target: EventTarget | null): void => {
    const event = eventFor(target)

    if (event === null) {
      tip.hidden = true

      return
    }

    place(root, tip, event)
  }

  root.addEventListener('mouseover', (event) => {
    show(event.target)
  })
  root.addEventListener('mouseleave', () => {
    tip.hidden = true
  })
  root.addEventListener('focusin', (event) => {
    show(event.target)
  })
  root.addEventListener('focusout', () => {
    tip.hidden = true
  })
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      tip.hidden = true
    }
  })
  root.addEventListener(
    'scroll',
    () => {
      tip.hidden = true
    },
    true
  )
}

function initAllCalendars(): void {
  const roots = document.querySelectorAll('.aha-cal[data-cal-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      initCalendar(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllCalendars)
} else {
  initAllCalendars()
}
