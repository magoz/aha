/**
 * Steps browser client. Timed steps get a start/pause countdown (one
 * running at a time, gentle accent cue when done, no audio) and the
 * current step highlight moves with Prev/Next or by clicking a step
 * header. Without scripts the list reads as a plain ordered list.
 * No Effect or Schema here.
 */

function formatRemaining(totalSec: number): string {
  const clamped = Math.max(0, Math.ceil(totalSec))

  if (clamped < 60) {
    return `0:${clamped < 10 ? '0' : ''}${String(clamped)}`
  }

  const minutes = Math.floor(clamped / 60)
  const seconds = clamped - minutes * 60

  if (minutes < 60) {
    return `${String(minutes)}:${seconds < 10 ? '0' : ''}${String(seconds)}`
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes - hours * 60

  return `${String(hours)}:${rest < 10 ? '0' : ''}${String(rest)}:${seconds < 10 ? '0' : ''}${String(seconds)}`
}

interface StepState {
  readonly item: HTMLElement
  readonly button: HTMLElement
  readonly remaining: HTMLElement
  total: number
  left: number
  endAt: number | null
  timer: number | null
}

const states: Array<StepState> = []

function readDuration(item: HTMLElement): number | null {
  const raw = item.getAttribute('data-duration')

  if (raw === null) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function refresh(state: StepState): void {
  state.remaining.textContent = formatRemaining(state.left)

  if (state.left <= 0) {
    state.button.textContent = 'Restart'
    state.item.classList.add('done')

    if (state.item.querySelector('.done-mark') === null) {
      const header = state.item.querySelector('.step-h')

      if (header !== null) {
        const mark = document.createElement('span')
        mark.className = 'done-mark'
        mark.textContent = 'Done'
        header.appendChild(mark)
      }
    }

    return
  }

  state.item.classList.remove('done')
  const mark = state.item.querySelector('.done-mark')

  if (mark !== null) {
    mark.remove()
  }

  state.button.textContent = state.timer === null ? 'Start' : 'Pause'
}

function stopTicking(state: StepState): void {
  if (state.timer !== null) {
    window.clearInterval(state.timer)
    state.timer = null
  }

  state.endAt = null
}

function pauseState(state: StepState): void {
  if (state.timer === null || state.endAt === null) {
    return
  }

  state.left = Math.max(0, (state.endAt - Date.now()) / 1000)
  stopTicking(state)
  refresh(state)
}

function toggleState(state: StepState): void {
  if (state.timer !== null) {
    pauseState(state)

    return
  }

  if (state.left <= 0) {
    state.left = state.total
  }

  for (const other of states) {
    if (other !== state && other.timer !== null) {
      pauseState(other)
    }
  }

  state.endAt = Date.now() + state.left * 1000
  state.timer = window.setInterval(() => {
    if (state.endAt === null) {
      return
    }

    state.left = Math.max(0, (state.endAt - Date.now()) / 1000)

    if (state.left <= 0) {
      stopTicking(state)
    }

    refresh(state)
  }, 250)

  refresh(state)
}

function setCurrent(list: HTMLElement, items: Array<HTMLElement>, index: number): void {
  for (let position = 0; position < items.length; position += 1) {
    const item = items[position]

    if (item === undefined) {
      continue
    }

    if (position === index) {
      item.classList.add('current')
      item.setAttribute('aria-current', 'step')
    } else {
      item.classList.remove('current')
      item.removeAttribute('aria-current')
    }
  }

  const label = list.querySelector('.step-nav .pos')

  if (label !== null) {
    label.textContent = `Step ${String(index + 1)} of ${String(items.length)}`
  }
}

function currentIndex(items: Array<HTMLElement>): number {
  for (let index = 0; index < items.length; index += 1) {
    if (items[index]?.classList.contains('current') === true) {
      return index
    }
  }

  return 0
}

function initSteps(list: HTMLElement): void {
  const items: Array<HTMLElement> = []
  const found = list.querySelectorAll(':scope > li[data-step]')

  for (let index = 0; index < found.length; index += 1) {
    const node = found.item(index)

    if (node instanceof HTMLElement) {
      items.push(node)
    }
  }

  if (items.length === 0) {
    return
  }

  const nav = document.createElement('div')
  nav.className = 'step-nav'

  const prev = document.createElement('button')
  prev.type = 'button'
  prev.textContent = 'Previous'

  const next = document.createElement('button')
  next.type = 'button'
  next.textContent = 'Next'

  const pos = document.createElement('span')
  pos.className = 'pos'

  prev.addEventListener('click', () => {
    setCurrent(list, items, Math.max(0, currentIndex(items) - 1))
  })

  next.addEventListener('click', () => {
    setCurrent(list, items, Math.min(items.length - 1, currentIndex(items) + 1))
  })

  nav.appendChild(prev)
  nav.appendChild(next)
  nav.appendChild(pos)

  const first = list.firstChild

  if (first === null) {
    list.appendChild(nav)
  } else {
    list.insertBefore(nav, first)
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]

    if (item === undefined) {
      continue
    }

    const at = index
    const header = item.querySelector('.step-h')

    if (header instanceof HTMLElement) {
      header.setAttribute('role', 'button')
      header.setAttribute('tabindex', '0')
      header.addEventListener('click', () => {
        setCurrent(list, items, at)
      })
      header.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setCurrent(list, items, at)
        }
      })
    }

    const total = readDuration(item)

    if (total === null) {
      continue
    }

    const timer = document.createElement('div')
    timer.className = 'timer'

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Start'

    const remaining = document.createElement('span')
    remaining.className = 'left'
    remaining.textContent = formatRemaining(total)

    timer.appendChild(button)
    timer.appendChild(remaining)
    item.appendChild(timer)

    const state: StepState = {
      item,
      button,
      remaining,
      total,
      left: total,
      endAt: null,
      timer: null
    }

    states.push(state)

    button.addEventListener('click', () => {
      toggleState(state)
    })
  }

  setCurrent(list, items, 0)
}

function initAllSteps(): void {
  const lists = document.querySelectorAll('ol.aha-steps[data-steps-id]')

  for (let index = 0; index < lists.length; index += 1) {
    const list = lists.item(index)

    if (list instanceof HTMLElement) {
      if (list.querySelector('.step-nav') !== null) {
        continue
      }

      initSteps(list)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllSteps)
} else {
  initAllSteps()
}
