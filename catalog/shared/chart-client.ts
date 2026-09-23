/**
 * Shared chart interaction kit, bundled into every chart client.
 *
 * Pointer anywhere over the plot snaps to the nearest datum with a clamped
 * tooltip; tap does the same; arrow keys step through stops on the focusable
 * chart frame and Escape clears. Series labels emphasise their lane on
 * hover. Everything is delegated from the stable root so client re-renders
 * on resize keep working. No Effect here, only DOM and arithmetic.
 */

export interface ChartStop {
  readonly x: number
  readonly y: number
  readonly html: string
}

export interface ChartSurface {
  readonly root: HTMLElement
  readonly focusable: HTMLElement
  readonly tip: HTMLElement
  readonly getSvg: () => SVGSVGElement | null
  readonly getStops: () => ReadonlyArray<ChartStop>
}

export function observeContainerWidth(
  element: HTMLElement,
  onWidth: (width: number) => void
): void {
  const notify = (): void => {
    const rect = element.getBoundingClientRect()
    onWidth(Math.max(0, Math.round(rect.width)))
  }

  notify()

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      notify()
    })

    observer.observe(element)
  }
}

function nearestStopIndex(stops: ReadonlyArray<ChartStop>, x: number): number | null {
  let best: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index]

    if (stop === undefined) {
      continue
    }

    const distance = Math.abs(stop.x - x)

    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }

  return best
}

function eachElement(list: NodeListOf<Element>, apply: (node: Element) => void): void {
  for (let index = 0; index < list.length; index += 1) {
    const node = list.item(index)

    if (node !== null) {
      apply(node)
    }
  }
}

function clearSelection(surface: ChartSurface): void {
  surface.tip.hidden = true

  const svg = surface.getSvg()

  if (svg === null) {
    return
  }

  eachElement(svg.querySelectorAll('.on'), (node) => {
    node.classList.remove('on')
  })

  svg.classList.remove('dim')

  eachElement(svg.querySelectorAll('.hot'), (node) => {
    node.classList.remove('hot')
  })
}

function showStop(surface: ChartSurface, index: number, anchorX: number, anchorY: number): void {
  const stops = surface.getStops()
  const stop = stops[index]

  if (stop === undefined) {
    return
  }

  const svg = surface.getSvg()

  if (svg !== null) {
    eachElement(svg.querySelectorAll('.on'), (node) => {
      node.classList.remove('on')
    })

    eachElement(svg.querySelectorAll(`[data-stop="${String(index)}"]`), (node) => {
      node.classList.add('on')
    })
  }

  surface.tip.innerHTML = stop.html
  surface.tip.hidden = false

  const rootRect = surface.root.getBoundingClientRect()
  const tipWidth = surface.tip.offsetWidth
  const tipHeight = surface.tip.offsetHeight
  let left = anchorX - rootRect.left + 14
  let top = anchorY - rootRect.top - tipHeight - 12

  if (left + tipWidth > rootRect.width - 4) {
    left = anchorX - rootRect.left - tipWidth - 14
  }

  if (left < 4) {
    left = 4
  }

  if (top < 4) {
    top = anchorY - rootRect.top + 18
  }

  surface.tip.style.left = `${String(Math.round(left))}px`
  surface.tip.style.top = `${String(Math.round(top))}px`
}

function svgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { readonly x: number; readonly y: number } | null {
  const rect = svg.getBoundingClientRect()

  if (rect.width === 0) {
    return null
  }

  const viewBox = svg.viewBox.baseVal

  if (viewBox.width === 0) {
    return null
  }

  const scale = viewBox.width / rect.width

  return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale }
}

function laneFromLabel(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) {
    return null
  }

  const label = target.closest('.slabel')

  if (label === null) {
    return null
  }

  const raw = label.getAttribute('data-series')

  if (raw === null) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)

  if (!Number.isSafeInteger(parsed)) {
    return null
  }

  return parsed
}

function setEmphasis(surface: ChartSurface, lane: number | null): void {
  const svg = surface.getSvg()

  if (svg === null) {
    return
  }

  eachElement(svg.querySelectorAll('.hot'), (node) => {
    node.classList.remove('hot')
  })

  if (lane === null) {
    svg.classList.remove('dim')

    return
  }

  svg.classList.add('dim')

  eachElement(svg.querySelectorAll(`[data-series="${String(lane)}"]`), (node) => {
    node.classList.add('hot')
  })
}

export function enhanceChart(surface: ChartSurface): void {
  let current: number | null = null

  const pointAt = (clientX: number, clientY: number): void => {
    const svg = surface.getSvg()

    if (svg === null) {
      return
    }

    const point = svgPoint(svg, clientX, clientY)

    if (point === null) {
      return
    }

    const index = nearestStopIndex(surface.getStops(), point.x)

    if (index === null) {
      return
    }

    current = index
    showStop(surface, index, clientX, clientY)
  }

  surface.root.addEventListener('pointermove', (event) => {
    pointAt(event.clientX, event.clientY)
  })

  surface.root.addEventListener('pointerdown', (event) => {
    pointAt(event.clientX, event.clientY)
  })

  surface.root.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches.item(0)

      if (touch === null) {
        return
      }

      pointAt(touch.clientX, touch.clientY)
    },
    { passive: true }
  )

  surface.root.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') {
      return
    }

    current = null
    clearSelection(surface)
  })

  surface.root.addEventListener('mouseover', (event) => {
    setEmphasis(surface, laneFromLabel(event.target))
  })

  surface.root.addEventListener('mouseout', (event) => {
    if (laneFromLabel(event.target) !== null) {
      setEmphasis(surface, null)
    }
  })

  surface.focusable.addEventListener('keydown', (event) => {
    const stops = surface.getStops()

    if (stops.length === 0) {
      return
    }

    if (event.key === 'Escape') {
      current = null
      clearSelection(surface)

      return
    }

    let next: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = current === null ? 0 : Math.min(current + 1, stops.length - 1)
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = current === null ? stops.length - 1 : Math.max(current - 1, 0)
    }

    if (event.key === 'Home') {
      next = 0
    }

    if (event.key === 'End') {
      next = stops.length - 1
    }

    if (next === null) {
      return
    }

    event.preventDefault()
    current = next

    const stop = stops[next]

    if (stop === undefined) {
      return
    }

    const svg = surface.getSvg()

    if (svg === null) {
      showStop(surface, next, 0, 0)

      return
    }

    const rect = svg.getBoundingClientRect()
    const viewBox = svg.viewBox.baseVal
    const scale = viewBox.width === 0 ? 1 : rect.width / viewBox.width

    showStop(surface, next, rect.left + stop.x * scale, rect.top + stop.y * scale)
  })

  surface.focusable.addEventListener('blur', () => {
    current = null
    clearSelection(surface)
  })
}
