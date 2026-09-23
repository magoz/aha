# Aha component catalog

Single self-contained pages can embed **components**: a chart, table or prose
wrapper declared as one HTML block that only takes data. The author writes
prose as usual and drops in a block; `aha build` renders it to static
SVG/HTML (readable without scripts) and inlines the CSS and client code the
block needs.

## Authoring

A JSON component is a figure with its data inline:

```html
<figure data-aha="line-chart">
  <script type="application/json">
    { ...data... }
  </script>
  <figcaption>Fig. 1. Six models across five effort levels.</figcaption>
</figure>
```

Run `aha components` to list the catalog, and `aha components line-chart`
to see a component's fields (taken from its schema annotations) plus a
paste-ready example block. Components that wrap prose take child markup
instead of JSON:

```html
<aside data-aha="callout" data-kind="decision">
  <p>Serve private documents through the loopback gateway.</p>
</aside>
```

Build locally with no token; errors name the block and field, exit code 1:

```sh
aha build page.html -o built.html
```

The JSON stays in the output and generated parts are marked, so building a
built file returns the identical file. Everything outside the blocks is
preserved byte-for-byte. Only the used components' CSS and client code are
inlined. An optional `data-width="720"` on the block sets the static render
width (the showcase uses it for its desktop/mobile panes); the client still
re-renders to the live container width.

## Adding a component to an existing category

1. Create `catalog/<category>/<name>-schema.ts` with the Effect Schema wire
   shape. Annotate every field:
   `Schema.String.annotate({ description: '...' })`, and wrap optionals as
   `Schema.optional(...).annotate({ description: '...' })` so the
   description survives on the union node. Field docs for
   `aha components <name>` are derived from these annotations.
2. Create `catalog/<category>/<name>-render.ts` with pure renderer
   functions (string/SVG builders). Import only from `catalog/shared/` and
   `import type` the decoded input type. **No Effect, Schema, DOM, `typeof`,
   `as` casts or `filter().map()` chains**: this file is bundled into the
   browser client. Narrow validated JSON with the guards in
   `catalog/shared/guards.ts`.
3. Create `catalog/<category>/<name>-css.ts` exporting the component CSS
   string, and `catalog/<category>/<name>.client.ts` as the browser entry
   (an IIFE built by the repo build; see below). Client code uses
   `addEventListener` only, never inline handlers, and imports the shared
   interaction kit instead of reimplementing it. Components without
   interaction (like `callout`) skip the client file.
4. Create `catalog/<category>/<name>.ts` defining the `CatalogComponent`:
   name, category, summary, input kind, `fields:
describeSchemaFields(<Name>Schema)`, css, client bundle filename (or
   null), one or more realistic synthetic examples, and `renderJson` /
   `renderMarkup`. `renderJson` decodes with `Schema.decodeUnknownEffect`
   and maps failures to `BlockDecodeError` with `firstIssuePath` /
   `formatIssueDetail` from `catalog/decode.ts` (copy `line-chart.ts`).
   Markup components validate attributes and strip their own generated
   markers for idempotence (copy `callout.ts`).
5. Register it in `catalog/<category>/registry.ts`. That is the only shared
   file you touch. `aha components`, `aha build` and the showcase pick the
   component up automatically.

## Adding a category

Add `catalog/<id>/registry.ts` exporting `<id>Components`, then add one
entry to `catalogCategories` in `catalog/categories.ts`. That list is the
only aggregation point; workers adding components to existing categories
never edit it.

## Services and layers

IO and dependencies live behind Effect services next to the code that needs
them (`catalog/services/`), following the `AhaStorage` flavour: a
`Context.Service` class with `make` and `static layer`.

- `CatalogFileStore` (`@aha/CatalogFileStore`) reads and writes text files.
  Used by `aha build` and the showcase writer.
- `ClientBundleStore` (`@aha/ClientBundleStore`) loads built client bundles
  from `dist/catalog`, resolving the directory from the launched executable
  (built `dist/cli/aha.js`), the module URL (source checkout) and the
  working directory, in that order.

Domain orchestration returns Effects and yields these services:
`buildPage(source)` in `catalog/build.ts` renders each block with
`Effect.forEach` and splices the results back; `runBuildFile` in
`catalog/build-file.ts` adds file IO; `buildShowcasePage` /
`writeShowcasePage` in `catalog/showcase.ts` generate the showcase. The CLI
(`cli/aha.ts`) and `tools/catalog-showcase.ts` are Effect programs composed
with `Layer.mergeAll` and run exactly once at the outermost entrypoint;
errors are handled with `Effect.catchTag` / `catchTags`.

Pure transformations stay plain functions: rendering, scales, ticks,
layout, formatting, block scanning and splicing. The browser bundles
contain no Effect at all (verified by build: no `effect` string in
`dist/catalog/*.client.js`).

Shared errors are `Schema.TaggedError` in `catalog/errors.ts`:
`UnknownComponentError`, `BlockDecodeError { blockIndex, component, path,
detail }` (with a `message` getter), `ClientBundleMissingError`,
`CatalogFileError`.

## Shared kit API

`catalog/shared/` is plain TypeScript used in Node and browsers:

- `scales.ts` — `linearScale` / `logScale` / `timeScale` factories plus
  `mapScale`. Data plus pure mapping functions.
- `ticks.ts` — `linearTicks`, `logTicks`, `timeTicks` returning labelled
  ticks; a few ticks per axis.
- `format.ts` — `formatNumberValue` (decimal/currency/percent),
  `formatDateTick`, `formatDateTimeTick`, `formatFullDate`,
  `parseTimeInput`.
- `svg.ts` — `escapeHtml`, `coord`, `linePath`, `bandPath`,
  `markerForSeries` (circle/square/triangle/diamond),
  `dashForSeries`, `markerGlyph`.
- `chart-frame.ts` — `layoutFrame`, `renderAxis`,
  `placeSeriesLabels` (collision avoidance with overflow clamping),
  `renderSeriesLabels`, `tooltipShell`.
- `chart-css.ts` — `CHART_CSS` shared chart styles.
- `chart-client.ts` — `enhanceChart({ root, focusable, tip, getSvg,
getStops })` plus `observeContainerWidth`. Pointer snap with clamped
  tooltip, tap (sticky on touch), keyboard arrows/Home/End, Escape clears,
  label hover emphasis. All listeners delegate from the stable root, so
  client re-renders swap only the `<svg>` and `<details>` nodes and never
  the chart frame itself.
- `guards.ts` — browser-safe JSON narrowing without Effect or `typeof`.

## Interaction and style rules

Every chart follows the same standard, implemented once in the kit:

- Pointer anywhere over the plot snaps to the nearest datum with a tooltip
  beside it, clamped inside the figure. Tap does the same (sticky on
  touch). Keyboard focus plus arrows step through data; Escape clears.
  Nothing is pre-selected.
- Series are labelled directly on the plot with collision avoidance, never
  in a legend; hovering a label emphasises its series.
- Axes carry a few labelled ticks: linear, log and time scales with nice
  ticks and number/currency/percent/date formatting (options per axis).
- Charts size to their container width (`ResizeObserver`, SVG scales) and
  never use viewport media queries; no horizontal overflow at 390px.
- Colours use the page tokens (`--paper`, `--ink`, `--muted`, `--rule`,
  `--hair`, `--accent`, `--warn`, ...). Series default to ink shades, dash
  patterns and marker glyphs; the accent is reserved for a `highlight`ed
  series. The muted six-colour categorical palette (light and dark
  variants) is the one documented opt-in exception. Rain and water use the
  blue lane, never `--warn`.
- `prefers-reduced-motion` disables transitions.
- Static markup reads without scripts; exact values ship in a collapsed
  `<details>` table where they make sense.

## Bundling

`tsup.config.ts` builds each `catalog/*/*.client.ts` entry to an IIFE in
`dist/catalog/<name>.client.js` (minified, no sourcemap). `aha build`
inlines the bundles for the used components only. Tests inject stub or
in-memory bundles through fake layers and never need `dist`.

## Tests

`tests/catalog-*.test.ts` use `@effect/vitest` (`it.effect`) with typed
fake layers (`Layer.succeed` for the bundle and file stores). They cover
decode error paths, deterministic rendering, idempotent builds,
byte-preservation, used-only inlining, registry aggregation and the
`aha components` output. Interaction (hover, keyboard, tap) is checked
against real Chromium under the production CSP via `pnpm preview --serve`
plus a throwaway CDP script (kept out of the repo).
