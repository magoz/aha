import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

import { Deferred, Effect, Predicate, Schema } from 'effect'

import { PreviewFailure, PreviewUsageError } from './preview-error.js'

export type ViewportName = 'desktop' | 'mobile'

export type ProblemKind = 'exception' | 'console' | 'csp' | 'overflow' | 'clip' | 'overlap'

export interface PreviewProblem {
  readonly viewport: ViewportName
  readonly kind: ProblemKind
  readonly message: string
}

export interface PreviewRunInput {
  readonly executable: string
  readonly url: string
  readonly outDir: string
  readonly stem: string
}

export interface PreviewRunResult {
  readonly desktopShot: string
  readonly mobileShot: string
  readonly desktopDarkShot: string
  readonly mobileDarkShot: string
  readonly desktopTiles: ReadonlyArray<string>
  readonly mobileTiles: ReadonlyArray<string>
  readonly desktopDarkTiles: ReadonlyArray<string>
  readonly mobileDarkTiles: ReadonlyArray<string>
  readonly problems: ReadonlyArray<PreviewProblem>
}

export type CdpValue = string | number | boolean | CdpParams | ReadonlyArray<CdpValue>

export interface CdpParams {
  readonly [name: string]: CdpValue
}

export interface CdpDriver {
  readonly socket: WebSocket
  readonly pending: Map<number, Deferred.Deferred<string, PreviewFailure>>
  readonly loadWaiters: Map<string, Deferred.Deferred<void, PreviewFailure>>
  readonly problems: Array<PreviewProblem>
  nextId: number
  currentViewport: ViewportName
}

const CHROMIUM_CANDIDATES: ReadonlyArray<string> = [
  'chromium',
  'chromium-browser',
  'google-chrome',
  'google-chrome-stable'
]

const CHROMIUM_MISSING_MESSAGE =
  'chromium not found: set AHA_CHROMIUM or install chromium, chromium-browser, google-chrome or google-chrome-stable'

const NO_CDP_PARAMS: CdpParams = {}

const CdpErrorSchema = Schema.Struct({
  code: Schema.Number,
  message: Schema.String
})

const EmptyResultSchema = Schema.Struct({})

const CreateTargetResultSchema = Schema.Struct({
  targetId: Schema.String
})

const AttachResultSchema = Schema.Struct({
  sessionId: Schema.String
})

const NavigateResultSchema = Schema.Struct({
  frameId: Schema.String
})

const LayoutMetricsResultSchema = Schema.Struct({
  cssContentSize: Schema.optional(
    Schema.Struct({
      width: Schema.Number,
      height: Schema.Number
    })
  )
})

const ScreenshotResultSchema = Schema.Struct({
  data: Schema.String
})

const RemoteValueSchema = Schema.Struct({
  type: Schema.String,
  value: Schema.optional(Schema.Unknown),
  unserializableValue: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String)
})

type RemoteValue = Schema.Schema.Type<typeof RemoteValueSchema>

const EvaluateResultSchema = Schema.Struct({
  result: RemoteValueSchema,
  exceptionDetails: Schema.optional(
    Schema.Struct({
      text: Schema.String
    })
  )
})

const CdpHeadSchema = Schema.Struct({
  id: Schema.optional(Schema.Number),
  method: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String)
})

const ConsoleApiEventSchema = Schema.Struct({
  method: Schema.Literal('Runtime.consoleAPICalled'),
  params: Schema.Struct({
    type: Schema.String,
    args: Schema.Array(RemoteValueSchema)
  })
})

const ExceptionEventSchema = Schema.Struct({
  method: Schema.Literal('Runtime.exceptionThrown'),
  params: Schema.Struct({
    exceptionDetails: Schema.Struct({
      text: Schema.String,
      exception: Schema.optional(
        Schema.Struct({
          description: Schema.optional(Schema.String)
        })
      )
    })
  })
})

const LogEventSchema = Schema.Struct({
  method: Schema.Literal('Log.entryAdded'),
  params: Schema.Struct({
    entry: Schema.Struct({
      level: Schema.String,
      source: Schema.String,
      text: Schema.String
    })
  })
})

const LoadEventSchema = Schema.Struct({
  method: Schema.Literal('Page.loadEventFired'),
  sessionId: Schema.optional(Schema.String)
})

const ContentSizeSchema = Schema.Struct({
  scroll: Schema.Number,
  client: Schema.Number
})

const ClipFindingSchema = Schema.Struct({
  component: Schema.String,
  overlay: Schema.String,
  clippedBy: Schema.String
})

const OverlapFindingSchema = Schema.Struct({
  component: Schema.String,
  element: Schema.String,
  detail: Schema.String
})

const ProbeFindingsSchema = Schema.Struct({
  clips: Schema.Array(ClipFindingSchema),
  overlaps: Schema.Array(OverlapFindingSchema)
})

function isExecutable(path: string): Effect.Effect<boolean, never> {
  return Effect.promise(() =>
    access(path, constants.X_OK).then(
      () => true,
      () => false
    )
  )
}

export function lookupChromiumOnPath(): Effect.Effect<string | null, never> {
  return Effect.gen(function* () {
    const rawPath = process.env['PATH']

    if (rawPath === undefined || rawPath.length === 0) {
      return null
    }

    const dirs = rawPath.split(delimiter)

    for (const dir of dirs) {
      for (const name of CHROMIUM_CANDIDATES) {
        const candidate = join(dir, name)
        const usable = yield* isExecutable(candidate)

        if (usable) {
          return candidate
        }
      }
    }

    return null
  })
}

export function resolveChromium(): Effect.Effect<string, PreviewUsageError> {
  return Effect.gen(function* () {
    const override = process.env['AHA_CHROMIUM']

    if (override !== undefined && override.length > 0) {
      const usable = yield* isExecutable(override)

      if (!usable) {
        return yield* Effect.fail(
          new PreviewUsageError({ message: `AHA_CHROMIUM is not executable: ${override}` })
        )
      }

      return override
    }

    const found = yield* lookupChromiumOnPath()

    if (found === null) {
      return yield* Effect.fail(new PreviewUsageError({ message: CHROMIUM_MISSING_MESSAGE }))
    }

    return found
  })
}

export function findDebuggerUrl(output: string): string | null {
  const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(output)

  if (match === null) {
    return null
  }

  const url = match[1]

  if (url === undefined || url.length === 0) {
    return null
  }

  return url
}

export function classifyLogEntry(source: string, text: string): ProblemKind {
  const lowered = text.toLowerCase()

  if (lowered.includes('content security policy') || source === 'security') {
    return 'csp'
  }

  return 'console'
}

function formatConsoleArg(arg: RemoteValue): string {
  if (arg.description !== undefined) {
    return arg.description
  }

  if (arg.unserializableValue !== undefined) {
    return arg.unserializableValue
  }

  if (arg.value !== undefined) {
    if (Predicate.isString(arg.value)) {
      return arg.value
    }

    const rendered = JSON.stringify(arg.value)

    if (rendered !== undefined) {
      return rendered
    }
  }

  return arg.type
}

function formatConsoleArgs(args: ReadonlyArray<RemoteValue>): string {
  const parts: Array<string> = []

  for (const arg of args) {
    parts.push(formatConsoleArg(arg))
  }

  return parts.join(' ')
}

type ServiceFreeSchema<Result> = Schema.Schema<Result> & { readonly DecodingServices: never }

function decodeCdpResult<Result>(
  resultSchema: ServiceFreeSchema<Result>,
  method: string,
  id: number,
  text: string
): Effect.Effect<Result, PreviewFailure> {
  return Effect.gen(function* () {
    const envelope = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(
        Schema.Struct({
          id: Schema.Number,
          result: resultSchema,
          error: Schema.optional(CdpErrorSchema)
        })
      )
    )(text).pipe(
      Effect.mapError(() => new PreviewFailure({ message: `invalid CDP response for ${method}` }))
    )

    if (envelope.error !== undefined) {
      return yield* Effect.fail(
        new PreviewFailure({ message: `CDP ${method} failed: ${envelope.error.message}` })
      )
    }

    if (envelope.id !== id) {
      return yield* Effect.fail(
        new PreviewFailure({ message: `CDP reply id mismatch for ${method}` })
      )
    }

    return envelope.result
  })
}

export function sendCdp<Result>(
  driver: CdpDriver,
  method: string,
  params: CdpParams,
  sessionId: string | null,
  resultSchema: ServiceFreeSchema<Result>
): Effect.Effect<Result, PreviewFailure> {
  return Effect.gen(function* () {
    const id = driver.nextId
    driver.nextId = id + 1

    const payload = {
      id,
      method,
      params,
      sessionId: sessionId === null ? undefined : sessionId
    }

    yield* Effect.try({
      try: () => driver.socket.send(JSON.stringify(payload)),
      catch: () => new PreviewFailure({ message: `cannot send CDP ${method}` })
    })

    const reply = Deferred.makeUnsafe<string, PreviewFailure>()
    driver.pending.set(id, reply)

    const text = yield* Deferred.await(reply).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          driver.pending.delete(id)
        })
      )
    )

    return yield* decodeCdpResult(resultSchema, method, id, text)
  })
}

function decodeCdpEvent<Event>(
  schema: ServiceFreeSchema<Event>,
  text: string
): Effect.Effect<Event | null, never> {
  return Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(text).pipe(
    Effect.orElseSucceed(() => null)
  )
}

function recordCdpEvent(driver: CdpDriver, text: string): Effect.Effect<void, never> {
  return Effect.gen(function* () {
    const viewport = driver.currentViewport

    const consoleEvent = yield* decodeCdpEvent(ConsoleApiEventSchema, text)

    if (consoleEvent !== null) {
      const level = consoleEvent.params.type

      if (level === 'error' || level === 'warning') {
        driver.problems.push({
          viewport,
          kind: 'console',
          message: `console.${level}: ${formatConsoleArgs(consoleEvent.params.args)}`
        })
      }

      return
    }

    const exceptionEvent = yield* decodeCdpEvent(ExceptionEventSchema, text)

    if (exceptionEvent !== null) {
      const details = exceptionEvent.params.exceptionDetails
      const description = details.exception?.description

      driver.problems.push({
        viewport,
        kind: 'exception',
        message: description === undefined ? details.text : `${details.text}: ${description}`
      })

      return
    }

    const logEvent = yield* decodeCdpEvent(LogEventSchema, text)

    if (logEvent !== null) {
      const entry = logEvent.params.entry

      if (entry.level === 'error' || entry.level === 'warning') {
        driver.problems.push({
          viewport,
          kind: classifyLogEntry(entry.source, entry.text),
          message: `${entry.level}: ${entry.text}`
        })
      }

      return
    }

    const loadEvent = yield* decodeCdpEvent(LoadEventSchema, text)

    if (loadEvent === null) {
      return
    }

    const session = loadEvent.sessionId

    if (session === undefined) {
      for (const waiter of driver.loadWaiters.values()) {
        Deferred.doneUnsafe(waiter, Effect.void)
      }

      driver.loadWaiters.clear()

      return
    }

    const waiter = driver.loadWaiters.get(session)

    if (waiter === undefined) {
      return
    }

    driver.loadWaiters.delete(session)
    Deferred.doneUnsafe(waiter, Effect.void)
  })
}

function handleIncoming(driver: CdpDriver, text: string): Effect.Effect<void, never> {
  return Effect.gen(function* () {
    const head = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(CdpHeadSchema))(text).pipe(
      Effect.orElseSucceed(() => null)
    )

    if (head === null) {
      return
    }

    if (head.id !== undefined) {
      const reply = driver.pending.get(head.id)

      if (reply === undefined) {
        return
      }

      driver.pending.delete(head.id)
      Deferred.doneUnsafe(reply, Effect.succeed(text))

      return
    }

    yield* recordCdpEvent(driver, text)
  })
}

function awaitDebuggerUrl(child: ChildProcess): Effect.Effect<string, PreviewFailure> {
  return Effect.callback<string, PreviewFailure>((resume) => {
    const stderr = child.stderr

    if (stderr === null) {
      resume(Effect.fail(new PreviewFailure({ message: 'cannot read Chromium stderr' })))

      return
    }

    let output = ''
    let settled = false

    const cleanup = (): void => {
      stderr.off('data', onData)
      child.off('exit', onExit)
      child.off('error', onError)
    }

    const finish = (result: Effect.Effect<string, PreviewFailure>): void => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resume(result)
    }

    const onData = (chunk: Uint8Array): void => {
      output += chunk.toString()

      const found = findDebuggerUrl(output)

      if (found !== null) {
        finish(Effect.succeed(found))
      }
    }

    const onExit = (): void => {
      const tail = output.slice(-2000)

      finish(
        Effect.fail(
          new PreviewFailure({ message: `Chromium exited before DevTools was ready: ${tail}` })
        )
      )
    }

    const onError = (): void => {
      finish(Effect.fail(new PreviewFailure({ message: 'cannot launch Chromium' })))
    }

    stderr.on('data', onData)
    child.once('exit', onExit)
    child.once('error', onError)

    return Effect.sync(cleanup)
  })
}

function connectBrowser(url: string): Effect.Effect<WebSocket, PreviewFailure> {
  return Effect.callback<WebSocket, PreviewFailure>((resume) => {
    let settled = false
    let socket: WebSocket | null = null

    const cleanup = (): void => {
      if (socket === null) {
        return
      }

      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('error', handleFailure)
    }

    const handleOpen = (): void => {
      if (settled || socket === null) {
        return
      }

      settled = true
      cleanup()
      resume(Effect.succeed(socket))
    }

    const handleFailure = (): void => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resume(Effect.fail(new PreviewFailure({ message: `cannot connect to Chromium at ${url}` })))
    }

    try {
      socket = new WebSocket(url)
      socket.addEventListener('open', handleOpen)
      socket.addEventListener('error', handleFailure)
    } catch {
      handleFailure()
    }

    return Effect.sync(cleanup)
  })
}

interface AttachedDriver {
  readonly driver: CdpDriver
  readonly sessionId: string
}

function connectDriver(debuggerUrl: string): Effect.Effect<AttachedDriver, PreviewFailure> {
  return Effect.gen(function* () {
    const socket = yield* connectBrowser(debuggerUrl)

    const driver: CdpDriver = {
      socket,
      pending: new Map(),
      loadWaiters: new Map(),
      problems: [],
      nextId: 1,
      currentViewport: 'desktop'
    }

    socket.addEventListener('message', (event) => {
      const data: unknown = event.data

      if (!Predicate.isString(data)) {
        return
      }

      Effect.runPromise(handleIncoming(driver, data)).catch(() => undefined)
    })

    const target = yield* sendCdp(
      driver,
      'Target.createTarget',
      { url: 'about:blank' },
      null,
      CreateTargetResultSchema
    )

    const attached = yield* sendCdp(
      driver,
      'Target.attachToTarget',
      { targetId: target.targetId, flatten: true },
      null,
      AttachResultSchema
    )

    const sessionId = attached.sessionId

    yield* sendCdp(driver, 'Page.enable', NO_CDP_PARAMS, sessionId, EmptyResultSchema)
    yield* sendCdp(driver, 'Runtime.enable', NO_CDP_PARAMS, sessionId, EmptyResultSchema)
    yield* sendCdp(driver, 'Log.enable', NO_CDP_PARAMS, sessionId, EmptyResultSchema)

    return { driver, sessionId }
  })
}

interface ViewportSpec {
  readonly name: ViewportName
  readonly width: number
  readonly height: number
  readonly mobile: boolean
}

const DESKTOP_SPEC: ViewportSpec = { name: 'desktop', width: 1280, height: 800, mobile: false }

const MOBILE_SPEC: ViewportSpec = { name: 'mobile', width: 390, height: 844, mobile: true }

const MAX_SHOT_HEIGHT = 10000

/** Tall pages are also saved as numbered tiles so agents can read one section at a time. */
const TILE_HEIGHT = 2000

const SETTLE_EXPRESSION =
  "(async () => { await document.fonts.ready; await new Promise((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(resolve) }) }); return 'ready' })()"

/**
 * Repaint wait after switching the emulated color scheme. Fonts are
 * already settled from the light pass, so this only forces the theme
 * recalc and waits two frames: no fixed sleeps.
 */
const DARK_REPAINT_EXPRESSION =
  '(() => { void document.documentElement.offsetWidth; return new Promise((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(resolve) }) }) })()'

const OVERFLOW_EXPRESSION =
  'JSON.stringify({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })'

/**
 * One injected probe evaluated through Runtime.evaluate. It exercises
 * interactive elements (charts get pointer moves near two plot corners,
 * other targets get mouseover plus focus), reports overlays that end up
 * clipped by an overflow ancestor or off the document width, and reports
 * chart SVGs whose box overlaps a following details block or caption.
 * Returns a JSON string decoded with ProbeFindingsSchema on the Node side.
 * Rescans are scoped to the interacted block: catalog event handlers only
 * reveal overlays inside their own root, so no other block can change.
 */
const PROBE_EXPRESSION = `(async () => {
  const run = async () => {
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
    const TOL = 1
    const MAX_TARGETS = 150
    const clips = []
    const overlaps = []
    const seenClips = new Set()
    const blocks = Array.from(document.querySelectorAll('[data-aha]'))
    const overflowCache = new Map()
    const describe = (el) => {
      const tag = el.tagName.toLowerCase()
      if (el.id) {
        return tag + '#' + el.id
      }
      const raw = el.className
      if (typeof raw === 'string') {
        const cls = raw.trim().split(/\\s+/).filter((part) => part.length > 0).slice(0, 2).join('.')
        if (cls.length > 0) {
          return tag + '.' + cls
        }
      }
      return tag
    }
    const componentOf = (el) => {
      const block = el.closest('[data-aha]')
      if (block === null) {
        return 'page'
      }
      return block.getAttribute('data-aha') || 'block'
    }
    const overlayName = (el) => {
      const raw = el.className
      if (typeof raw === 'string') {
        const cls = raw.trim().split(/\\s+/).filter((part) => part.length > 0).join('.')
        if (cls.length > 0) {
          return '.' + cls
        }
      }
      return describe(el)
    }
    const candidates = new Map()
    const allCandidates = []
    const scoped = document.querySelectorAll('[data-aha] *, [data-aha]')
    for (let index = 0; index < scoped.length; index += 1) {
      const el = scoped.item(index)
      if (!(el instanceof HTMLElement)) {
        continue
      }
      const pos = getComputedStyle(el).position
      if (pos !== 'absolute' && pos !== 'fixed') {
        continue
      }
      allCandidates.push(el)
      const owner = el.closest('[data-aha]')
      if (!(owner instanceof HTMLElement)) {
        continue
      }
      const list = candidates.get(owner)
      if (list === undefined) {
        candidates.set(owner, [el])
      } else {
        list.push(el)
      }
    }
    const isShown = (el) => {
      if (el.hidden) {
        return false
      }
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return false
      }
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
        return false
      }
      return true
    }
    const baseline = new Set()
    for (const el of allCandidates) {
      if (isShown(el)) {
        baseline.add(el)
      }
    }
    const overflowOf = (el) => {
      const hit = overflowCache.get(el)
      if (hit !== undefined) {
        return hit
      }
      const style = getComputedStyle(el)
      const value = { x: style.overflowX, y: style.overflowY }
      overflowCache.set(el, value)
      return value
    }
    const recordClip = (el) => {
      const rect = el.getBoundingClientRect()
      const component = componentOf(el)
      const overlay = overlayName(el)
      const fixed = getComputedStyle(el).position === 'fixed'
      if (!fixed) {
        let node = el.parentElement
        while (node !== null && node !== document.body && node !== document.documentElement) {
          const flow = overflowOf(node)
          if (flow.x !== 'visible' || flow.y !== 'visible') {
            const box = node.getBoundingClientRect()
            if (rect.left < box.left - TOL || rect.top < box.top - TOL || rect.right > box.right + TOL || rect.bottom > box.bottom + TOL) {
              const key = component + '|' + overlay + '|' + describe(node)
              if (!seenClips.has(key)) {
                seenClips.add(key)
                clips.push({ component, overlay, clippedBy: describe(node) })
              }
            }
          }
          node = node.parentElement
        }
      }
      const docWidth = document.documentElement.clientWidth
      if (rect.right > docWidth + TOL || rect.left < 0 - TOL) {
        const key = component + '|' + overlay + '|document'
        if (!seenClips.has(key)) {
          seenClips.add(key)
          clips.push({ component, overlay, clippedBy: 'document' })
        }
      }
    }
    const scan = (scope) => {
      const list = scope === null ? allCandidates : (candidates.get(scope) ?? [])
      for (const el of list) {
        if (baseline.has(el)) {
          continue
        }
        if (!isShown(el)) {
          continue
        }
        recordClip(el)
      }
    }
    const pressChart = (chart) => {
      const svg = chart.querySelector('svg')
      const box = (svg instanceof Element ? svg : chart).getBoundingClientRect()
      const points = [
        { x: box.left + 8, y: box.top + 8 },
        { x: box.right - 8, y: box.bottom - 8 }
      ]
      for (const point of points) {
        const init = { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 0 }
        chart.dispatchEvent(new PointerEvent('pointerover', Object.assign({ pointerType: 'mouse' }, init)))
        chart.dispatchEvent(new PointerEvent('pointermove', Object.assign({ pointerType: 'mouse' }, init)))
        chart.dispatchEvent(new MouseEvent('mousemove', init))
        chart.dispatchEvent(new MouseEvent('mouseover', init))
      }
    }
    const pressNode = (el) => {
      const rect = el.getBoundingClientRect()
      const init = { bubbles: true, cancelable: true, clientX: (rect.left + rect.right) / 2, clientY: (rect.top + rect.bottom) / 2 }
      el.dispatchEvent(new PointerEvent('pointerover', Object.assign({ pointerType: 'mouse' }, init)))
      el.dispatchEvent(new MouseEvent('mouseover', init))
      try {
        el.focus({ preventScroll: true })
      } catch {
      }
    }
    const reset = (el, chart) => {
      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }))
      el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, cancelable: true }))
      const root = chart !== null ? chart : el.closest('[data-aha]')
      if (root instanceof HTMLElement) {
        root.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false, cancelable: true, pointerType: 'mouse' }))
        root.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, cancelable: true }))
        root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      }
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        active.blur()
      }
    }
    const jobs = []
    const pushJob = (el, chart, block) => {
      if (jobs.length >= MAX_TARGETS) {
        return
      }
      for (const job of jobs) {
        if (job.el === el) {
          return
        }
      }
      jobs.push({ el, chart, block })
    }
    for (const block of blocks) {
      if (!(block instanceof HTMLElement)) {
        continue
      }
      const charts = block.querySelectorAll('.aha-chart')
      for (let index = 0; index < charts.length; index += 1) {
        const chart = charts.item(index)
        if (chart instanceof HTMLElement) {
          pushJob(chart, chart, block)
        }
      }
      const inners = []
      const found = block.querySelectorAll('[tabindex], button, summary')
      for (let index = 0; index < found.length; index += 1) {
        const el = found.item(index)
        if (el instanceof HTMLElement) {
          inners.push(el)
        }
      }
      if (inners.length <= 3) {
        for (const el of inners) {
          pushJob(el, null, block)
        }
      } else {
        const first = inners[0]
        const middle = inners[Math.floor(inners.length / 2)]
        const last = inners[inners.length - 1]
        if (first !== undefined) {
          pushJob(first, null, block)
        }
        if (middle !== undefined) {
          pushJob(middle, null, block)
        }
        if (last !== undefined) {
          pushJob(last, null, block)
        }
      }
    }
    for (const job of jobs) {
      if (job.chart !== null) {
        pressChart(job.chart)
      } else {
        pressNode(job.el)
      }
      scan(job.block)
      reset(job.el, job.chart)
    }
    const active = document.activeElement
    if (active instanceof HTMLElement) {
      active.blur()
    }
    for (const block of blocks) {
      if (!(block instanceof HTMLElement)) {
        continue
      }
      const component = block.getAttribute('data-aha') || 'block'
      const direct = block.querySelector(':scope > svg')
      const inChart = block.querySelector(':scope > .aha-chart > svg')
      let svg = null
      if (direct instanceof Element) {
        svg = direct
      } else if (inChart instanceof Element) {
        svg = inChart
      }
      if (svg === null) {
        continue
      }
      const box = svg.getBoundingClientRect()
      if (box.width <= 0 || box.height <= 0) {
        continue
      }
      const followers = block.querySelectorAll('details.aha-values, figcaption')
      for (let index = 0; index < followers.length; index += 1) {
        const fol = followers.item(index)
        if (!(fol instanceof HTMLElement)) {
          continue
        }
        if (!(svg.compareDocumentPosition(fol) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          continue
        }
        const other = fol.getBoundingClientRect()
        if (other.width <= 0 || other.height <= 0) {
          continue
        }
        const vertical = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top)
        const horizontal = Math.min(box.right, other.right) - Math.max(box.left, other.left)
        if (vertical > 2 && horizontal > 0) {
          overlaps.push({ component, element: describe(fol), detail: String(Math.round(vertical)) + 'px vertical overlap' })
        }
      }
    }
    return JSON.stringify({ clips, overlaps })
  }
  return run()
})()`

function watchLoad(driver: CdpDriver, sessionId: string): Deferred.Deferred<void, PreviewFailure> {
  const waiter = Deferred.makeUnsafe<void, PreviewFailure>()
  driver.loadWaiters.set(sessionId, waiter)

  return waiter
}

function settlePage(driver: CdpDriver, sessionId: string): Effect.Effect<void, PreviewFailure> {
  return Effect.gen(function* () {
    const outcome = yield* sendCdp(
      driver,
      'Runtime.evaluate',
      { expression: SETTLE_EXPRESSION, awaitPromise: true, returnByValue: true },
      sessionId,
      EvaluateResultSchema
    )

    const details = outcome.exceptionDetails

    if (details !== undefined) {
      driver.problems.push({
        viewport: driver.currentViewport,
        kind: 'exception',
        message: `settle failed: ${details.text}`
      })
    }
  })
}

function settleDarkRepaint(
  driver: CdpDriver,
  sessionId: string
): Effect.Effect<void, PreviewFailure> {
  return Effect.gen(function* () {
    const outcome = yield* sendCdp(
      driver,
      'Runtime.evaluate',
      { expression: DARK_REPAINT_EXPRESSION, awaitPromise: true, returnByValue: true },
      sessionId,
      EvaluateResultSchema
    )

    const details = outcome.exceptionDetails

    if (details !== undefined) {
      driver.problems.push({
        viewport: driver.currentViewport,
        kind: 'exception',
        message: `dark repaint failed: ${details.text}`
      })
    }
  })
}

function readContentHeight(
  driver: CdpDriver,
  sessionId: string,
  fallback: number
): Effect.Effect<number, PreviewFailure> {
  return Effect.gen(function* () {
    const metrics = yield* sendCdp(
      driver,
      'Page.getLayoutMetrics',
      NO_CDP_PARAMS,
      sessionId,
      LayoutMetricsResultSchema
    )

    const size = metrics.cssContentSize

    if (size === undefined) {
      return fallback
    }

    const full = Math.ceil(size.height)

    if (!Number.isSafeInteger(full) || full < fallback) {
      return fallback
    }

    if (full > MAX_SHOT_HEIGHT) {
      return MAX_SHOT_HEIGHT
    }

    return full
  })
}

function checkMobileOverflow(
  driver: CdpDriver,
  sessionId: string
): Effect.Effect<void, PreviewFailure> {
  return Effect.gen(function* () {
    const outcome = yield* sendCdp(
      driver,
      'Runtime.evaluate',
      { expression: OVERFLOW_EXPRESSION, returnByValue: true },
      sessionId,
      EvaluateResultSchema
    )

    if (outcome.exceptionDetails !== undefined) {
      return
    }

    const raw = outcome.result.value

    if (!Predicate.isString(raw)) {
      return
    }

    const size = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ContentSizeSchema))(
      raw
    ).pipe(Effect.orElseSucceed(() => null))

    if (size === null) {
      return
    }

    if (size.scroll > size.client) {
      driver.problems.push({
        viewport: 'mobile',
        kind: 'overflow',
        message: `horizontal overflow: scrollWidth ${String(size.scroll)} > clientWidth ${String(size.client)}`
      })
    }
  })
}

interface ViewportShots {
  readonly shot: string
  readonly tiles: ReadonlyArray<string>
  readonly darkShot: string
  readonly darkTiles: ReadonlyArray<string>
}

function runProbeChecks(driver: CdpDriver, sessionId: string): Effect.Effect<void, PreviewFailure> {
  return Effect.gen(function* () {
    const outcome = yield* sendCdp(
      driver,
      'Runtime.evaluate',
      { expression: PROBE_EXPRESSION, awaitPromise: true, returnByValue: true },
      sessionId,
      EvaluateResultSchema
    )

    if (outcome.exceptionDetails !== undefined) {
      driver.problems.push({
        viewport: driver.currentViewport,
        kind: 'exception',
        message: `probe failed: ${outcome.exceptionDetails.text}`
      })

      return
    }

    const raw = outcome.result.value

    if (!Predicate.isString(raw)) {
      return yield* Effect.fail(new PreviewFailure({ message: 'invalid probe result' }))
    }

    const findings = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ProbeFindingsSchema))(
      raw
    ).pipe(Effect.mapError(() => new PreviewFailure({ message: 'invalid probe result' })))

    for (const clip of findings.clips) {
      driver.problems.push({
        viewport: driver.currentViewport,
        kind: 'clip',
        message: `${clip.component}: overlay ${clip.overlay} clipped by ${clip.clippedBy}`
      })
    }

    for (const overlap of findings.overlaps) {
      driver.problems.push({
        viewport: driver.currentViewport,
        kind: 'overlap',
        message: `${overlap.component}: chart svg overlaps ${overlap.element} (${overlap.detail})`
      })
    }
  })
}

function captureTiles(
  driver: CdpDriver,
  sessionId: string,
  spec: ViewportSpec,
  fullHeight: number,
  outDir: string,
  stem: string,
  suffix: string
): Effect.Effect<ReadonlyArray<string>, PreviewFailure> {
  return Effect.gen(function* () {
    if (fullHeight <= TILE_HEIGHT * 1.2) {
      return []
    }

    const tiles: Array<string> = []

    for (let top = 0; top < fullHeight; top += TILE_HEIGHT) {
      const height = Math.min(TILE_HEIGHT, fullHeight - top)

      const tile = yield* sendCdp(
        driver,
        'Page.captureScreenshot',
        {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: 0, y: top, width: spec.width, height, scale: 1 }
        },
        sessionId,
        ScreenshotResultSchema
      )

      const index = String(tiles.length + 1).padStart(2, '0')
      const tilePath = join(outDir, `${stem}.${spec.name}${suffix}.${index}.png`)

      yield* Effect.tryPromise({
        try: () => writeFile(tilePath, Buffer.from(tile.data, 'base64')),
        catch: () => new PreviewFailure({ message: `cannot write screenshot: ${tilePath}` })
      })

      tiles.push(tilePath)
    }

    return tiles
  })
}

function runViewport(
  driver: CdpDriver,
  sessionId: string,
  spec: ViewportSpec,
  url: string,
  outDir: string,
  stem: string
): Effect.Effect<ViewportShots, PreviewFailure> {
  return Effect.gen(function* () {
    driver.currentViewport = spec.name

    yield* sendCdp(
      driver,
      'Emulation.setDeviceMetricsOverride',
      { width: spec.width, height: spec.height, deviceScaleFactor: 1, mobile: spec.mobile },
      sessionId,
      EmptyResultSchema
    )

    const waiter = watchLoad(driver, sessionId)

    yield* sendCdp(driver, 'Page.navigate', { url }, sessionId, NavigateResultSchema)

    yield* Deferred.await(waiter).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          driver.loadWaiters.delete(sessionId)
        })
      )
    )

    yield* settlePage(driver, sessionId)

    const fullHeight = yield* readContentHeight(driver, sessionId, spec.height)

    if (fullHeight !== spec.height) {
      yield* sendCdp(
        driver,
        'Emulation.setDeviceMetricsOverride',
        { width: spec.width, height: fullHeight, deviceScaleFactor: 1, mobile: spec.mobile },
        sessionId,
        EmptyResultSchema
      )
    }

    const shot = yield* sendCdp(
      driver,
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: true },
      sessionId,
      ScreenshotResultSchema
    )

    const shotPath = join(outDir, `${stem}.${spec.name}.png`)

    yield* Effect.tryPromise({
      try: () => writeFile(shotPath, Buffer.from(shot.data, 'base64')),
      catch: () => new PreviewFailure({ message: `cannot write screenshot: ${shotPath}` })
    })

    const tiles = yield* captureTiles(driver, sessionId, spec, fullHeight, outDir, stem, '')

    yield* runProbeChecks(driver, sessionId)

    if (spec.mobile) {
      yield* checkMobileOverflow(driver, sessionId)
    }

    yield* sendCdp(
      driver,
      'Emulation.setEmulatedMedia',
      { media: 'screen', features: [{ name: 'prefers-color-scheme', value: 'dark' }] },
      sessionId,
      EmptyResultSchema
    )

    yield* settleDarkRepaint(driver, sessionId)

    const darkShot = yield* sendCdp(
      driver,
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: true },
      sessionId,
      ScreenshotResultSchema
    )

    const darkShotPath = join(outDir, `${stem}.${spec.name}.dark.png`)

    yield* Effect.tryPromise({
      try: () => writeFile(darkShotPath, Buffer.from(darkShot.data, 'base64')),
      catch: () => new PreviewFailure({ message: `cannot write screenshot: ${darkShotPath}` })
    })

    const darkTiles = yield* captureTiles(
      driver,
      sessionId,
      spec,
      fullHeight,
      outDir,
      stem,
      '.dark'
    )

    yield* sendCdp(
      driver,
      'Emulation.setEmulatedMedia',
      NO_CDP_PARAMS,
      sessionId,
      EmptyResultSchema
    )

    return { shot: shotPath, tiles, darkShot: darkShotPath, darkTiles }
  })
}

interface LaunchedBrowser {
  readonly child: ChildProcess
  readonly debuggerUrl: string
}

function killBrowserGroup(child: ChildProcess): void {
  const pid = child.pid

  if (pid === undefined) {
    child.kill('SIGKILL')

    return
  }

  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

function launchBrowser(
  executable: string,
  profileDir: string
): Effect.Effect<LaunchedBrowser, PreviewFailure> {
  return Effect.gen(function* () {
    const child = yield* Effect.try({
      try: () =>
        spawn(
          executable,
          [
            '--headless=new',
            '--remote-debugging-port=0',
            `--user-data-dir=${profileDir}`,
            'about:blank'
          ],
          // Chromium puts its singleton socket dir in TMPDIR; keep it inside the removed profile.
          {
            stdio: ['ignore', 'ignore', 'pipe'],
            detached: true,
            env: { ...process.env, TMPDIR: profileDir }
          }
        ),
      catch: () => new PreviewFailure({ message: 'cannot launch Chromium' })
    })

    const debuggerUrl = yield* awaitDebuggerUrl(child)

    return { child, debuggerUrl }
  })
}

export function runPreviewBrowser(
  input: PreviewRunInput
): Effect.Effect<PreviewRunResult, PreviewFailure> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => mkdir(input.outDir, { recursive: true }),
      catch: () =>
        new PreviewFailure({ message: `cannot create output directory: ${input.outDir}` })
    })

    const profileDir = yield* Effect.tryPromise({
      try: () => mkdtemp(join(tmpdir(), 'aha-preview-')),
      catch: () => new PreviewFailure({ message: 'cannot create Chromium profile directory' })
    })

    return yield* Effect.acquireUseRelease(
      launchBrowser(input.executable, profileDir),
      (browser) =>
        Effect.acquireUseRelease(
          connectDriver(browser.debuggerUrl),
          (attached) =>
            Effect.gen(function* () {
              const desktopShot = yield* runViewport(
                attached.driver,
                attached.sessionId,
                DESKTOP_SPEC,
                input.url,
                input.outDir,
                input.stem
              )

              const mobileShot = yield* runViewport(
                attached.driver,
                attached.sessionId,
                MOBILE_SPEC,
                input.url,
                input.outDir,
                input.stem
              )

              return {
                desktopShot: desktopShot.shot,
                mobileShot: mobileShot.shot,
                desktopDarkShot: desktopShot.darkShot,
                mobileDarkShot: mobileShot.darkShot,
                desktopTiles: desktopShot.tiles,
                mobileTiles: mobileShot.tiles,
                desktopDarkTiles: desktopShot.darkTiles,
                mobileDarkTiles: mobileShot.darkTiles,
                problems: attached.driver.problems.slice()
              }
            }),
          (attached) =>
            Effect.sync((): void => {
              attached.driver.socket.close()
            })
        ),
      (browser) =>
        Effect.gen(function* () {
          yield* Effect.sync((): void => {
            killBrowserGroup(browser.child)
          })

          yield* Effect.tryPromise({
            try: () => rm(profileDir, { recursive: true, force: true }),
            catch: () => new PreviewFailure({ message: 'cannot remove Chromium profile' })
          }).pipe(Effect.orElseSucceed(() => undefined))
        })
    )
  })
}
