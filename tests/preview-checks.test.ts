import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { lookupChromiumOnPath, runPreviewBrowser } from '../tools/preview-browser.js'
import { startPreviewServer } from '../tools/preview-server.js'

// Shared CI runners start Chromium slowly while several browser test files run at once.
const BROWSER_TEST_TIMEOUT_MS = 90000

const CLIP_HTML =
  '<!doctype html><html><head><title>clip</title><style>' +
  '[data-aha]{position:relative;max-width:40rem}' +
  '.cell{overflow:hidden;width:120px;border:1px solid #111}' +
  '.trig{position:relative;display:block}' +
  '.tip{position:absolute;left:0;top:100%;width:200px;background:#fff;border:1px solid #111}' +
  '.tip[hidden]{display:none}' +
  '</style></head><body>' +
  '<figure data-aha="test-clip"><div class="cell">' +
  '<span class="trig" tabindex="0">hover me<span class="tip" hidden="hidden">detail text</span></span>' +
  '</div></figure>' +
  '<script>' +
  "document.querySelectorAll('.trig').forEach((el) => {" +
  "const tip = el.querySelector('.tip');" +
  "el.addEventListener('mouseover', () => { tip.hidden = false });" +
  "el.addEventListener('mouseleave', () => { tip.hidden = true });" +
  "el.addEventListener('focus', () => { tip.hidden = false });" +
  "el.addEventListener('blur', () => { tip.hidden = true });" +
  "el.addEventListener('keydown', (event) => { if (event.key === 'Escape') { tip.hidden = true } });" +
  '});' +
  '</script></body></html>'

const NO_CLIP_HTML = CLIP_HTML.replace('overflow:hidden', 'overflow:visible')

const OVERLAP_HTML =
  '<!doctype html><html><head><title>overlap</title></head><body>' +
  '<figure data-aha="test-overlap"><div class="aha-chart">' +
  '<svg width="100%" height="60" viewBox="0 0 640 60"><rect x="8" y="10" width="624" height="40" /></svg>' +
  '<details class="aha-values" style="margin-top:-20px"><summary>Exact values</summary>' +
  '<p>values</p></details></div></figure>' +
  '</body></html>'

// The real proportion-bar bug: the viewBox was shorter than the bars, so the shapes
// painted past the svg box (overflow visible) onto the following details.
const SPILL_HTML =
  '<!doctype html><html><head><title>spill</title><style>svg{display:block;width:100%;height:auto;overflow:visible}</style></head><body>' +
  '<figure data-aha="test-spill"><div class="aha-chart">' +
  '<svg viewBox="0 0 640 20"><rect x="8" y="10" width="624" height="40" /></svg>' +
  '<details class="aha-values"><summary>Exact values</summary>' +
  '<p>values</p></details></div></figure>' +
  '</body></html>'

const THEME_HTML =
  '<!doctype html><html><head><title>theme</title><style>' +
  'body{background:#fff;color:#111}' +
  '@media (prefers-color-scheme: dark){body{background:#000;color:#eee}}' +
  '.box{height:400px}' +
  '</style></head><body><div class="box"><p>themed page</p></div></body></html>'

function runOnHtml(
  html: string,
  stem: string
): Effect.Effect<
  {
    readonly problems: ReadonlyArray<{ kind: string; message: string }>
    readonly desktopShot: string
    readonly mobileShot: string
    readonly desktopDarkShot: string
    readonly mobileDarkShot: string
  },
  Error
> {
  return Effect.gen(function* () {
    const executable = yield* lookupChromiumOnPath()

    if (executable === null) {
      return {
        problems: [],
        desktopShot: '',
        mobileShot: '',
        desktopDarkShot: '',
        mobileDarkShot: ''
      }
    }

    const dir = yield* Effect.tryPromise({
      try: () => mkdtemp(join(tmpdir(), 'aha-preview-checks-')),
      catch: () => new Error('mkdtemp failed')
    })

    try {
      const file = join(dir, `${stem}.html`)

      yield* Effect.tryPromise({
        try: () => writeFile(file, html),
        catch: () => new Error('write failed')
      })

      return yield* Effect.acquireUseRelease(
        startPreviewServer(file, null).pipe(Effect.mapError(() => new Error('server failed'))),
        (server) =>
          Effect.gen(function* () {
            const result = yield* runPreviewBrowser({
              executable,
              url: server.url,
              outDir: join(dir, 'shots'),
              stem
            }).pipe(Effect.mapError((error) => new Error(`capture failed: ${error.message}`)))

            return {
              problems: result.problems,
              desktopShot: result.desktopShot,
              mobileShot: result.mobileShot,
              desktopDarkShot: result.desktopDarkShot,
              mobileDarkShot: result.mobileDarkShot
            }
          }),
        (server) => server.close.pipe(Effect.orElseSucceed(() => undefined))
      )
    } finally {
      yield* Effect.tryPromise({
        try: () => rm(dir, { recursive: true, force: true }),
        catch: () => new Error('cleanup failed')
      }).pipe(Effect.orElseSucceed(() => undefined))
    }
  })
}

describe('preview clip probe', () => {
  it.effect(
    'reports a tooltip clipped by an overflow hidden cell',
    () =>
      Effect.gen(function* () {
        const executable = yield* lookupChromiumOnPath()

        if (executable === null) {
          return
        }

        const run = yield* runOnHtml(CLIP_HTML, 'clip')
        const clips = run.problems.filter((problem) => problem.kind === 'clip')

        expect(clips.length).toBeGreaterThan(0)
        expect(clips[0]?.message).toContain('test-clip')
        expect(clips[0]?.message).toContain('.tip')
        expect(clips[0]?.message).toContain('div.cell')
      }),
    BROWSER_TEST_TIMEOUT_MS
  )

  it.effect(
    'stays clean when the cell does not clip',
    () =>
      Effect.gen(function* () {
        const executable = yield* lookupChromiumOnPath()

        if (executable === null) {
          return
        }

        const run = yield* runOnHtml(NO_CLIP_HTML, 'noclip')

        expect(run.problems).toEqual([])
      }),
    BROWSER_TEST_TIMEOUT_MS
  )
})

describe('preview overlap check', () => {
  it.effect(
    'reports a chart svg overlapping its following details',
    () =>
      Effect.gen(function* () {
        const executable = yield* lookupChromiumOnPath()

        if (executable === null) {
          return
        }

        const run = yield* runOnHtml(OVERLAP_HTML, 'overlap')
        const overlaps = run.problems.filter((problem) => problem.kind === 'overlap')

        expect(overlaps.length).toBeGreaterThan(0)
        expect(overlaps[0]?.message).toContain('test-overlap')
        expect(overlaps[0]?.message).toContain('details.aha-values')
      }),
    BROWSER_TEST_TIMEOUT_MS
  )

  it.effect(
    'reports svg content that spills past a too-short viewBox',
    () =>
      Effect.gen(function* () {
        const executable = yield* lookupChromiumOnPath()

        if (executable === null) {
          return
        }

        const run = yield* runOnHtml(SPILL_HTML, 'spill')
        const overlaps = run.problems.filter((problem) => problem.kind === 'overlap')

        expect(overlaps.length).toBeGreaterThan(0)
        expect(overlaps[0]?.message).toContain('test-spill')
      }),
    BROWSER_TEST_TIMEOUT_MS
  )
})

describe('preview dark screenshots', () => {
  it.effect(
    'captures dark shots that differ from the light ones',
    () =>
      Effect.gen(function* () {
        const executable = yield* lookupChromiumOnPath()

        if (executable === null) {
          return
        }

        const dir = yield* Effect.tryPromise({
          try: () => mkdtemp(join(tmpdir(), 'aha-preview-dark-')),
          catch: () => new Error('mkdtemp failed')
        })

        try {
          const file = join(dir, 'theme.html')

          yield* Effect.tryPromise({
            try: () => writeFile(file, THEME_HTML),
            catch: () => new Error('write failed')
          })

          return yield* Effect.acquireUseRelease(
            startPreviewServer(file, null).pipe(Effect.mapError(() => new Error('server failed'))),
            (server) =>
              Effect.gen(function* () {
                const result = yield* runPreviewBrowser({
                  executable,
                  url: server.url,
                  outDir: join(dir, 'shots'),
                  stem: 'theme'
                }).pipe(Effect.mapError((error) => new Error(`capture failed: ${error.message}`)))

                expect(result.desktopDarkShot.endsWith('theme.desktop.dark.png')).toBe(true)
                expect(result.mobileDarkShot.endsWith('theme.mobile.dark.png')).toBe(true)

                const read = (path: string): Effect.Effect<Buffer, Error> =>
                  Effect.tryPromise({
                    try: () => readFile(path),
                    catch: () => new Error(`read failed: ${path}`)
                  })

                const light = yield* read(result.desktopShot)
                const dark = yield* read(result.desktopDarkShot)
                const lightMobile = yield* read(result.mobileShot)
                const darkMobile = yield* read(result.mobileDarkShot)

                expect(dark.length).toBeGreaterThan(1000)
                expect(darkMobile.length).toBeGreaterThan(1000)
                expect(dark.equals(light)).toBe(false)
                expect(darkMobile.equals(lightMobile)).toBe(false)

                const darkSize = yield* Effect.tryPromise({
                  try: () => stat(result.desktopDarkShot).then((info) => info.size),
                  catch: () => new Error('stat failed')
                })

                expect(darkSize).toBeGreaterThan(1000)
              }),
            (server) => server.close.pipe(Effect.orElseSucceed(() => undefined))
          )
        } finally {
          yield* Effect.tryPromise({
            try: () => rm(dir, { recursive: true, force: true }),
            catch: () => new Error('cleanup failed')
          })
        }
      }),
    BROWSER_TEST_TIMEOUT_MS
  )
})
