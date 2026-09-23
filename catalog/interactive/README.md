# Interactive components

Controls that change what the page shows. Every component renders a full
static view without scripts and enhances it with a small client bundle.

- `tabs` — `<div data-aha="tabs">` over `<section data-tab="Label">`
  children. Stacked with headings without scripts; an accessible
  tablist (arrow keys, Home/End, aria) with scripts.
- `scenarios` — `<div data-aha="scenarios">` over
  `<section data-scenario="Label">` children holding prose and nested
  catalog blocks (a line-chart per scenario). A segmented control
  switches between them; nested blocks are built recursively by
  `buildPage` (see `catalog/blocks.ts`), and hidden charts re-measure
  through their ResizeObserver when revealed.
- `steps` — `<ol data-aha="steps">` with `<li data-step="Title">`
  children, optional `data-duration` seconds and a `data-ready` cue
  paragraph per step. Timed steps get start/pause countdowns (one at a
  time, accent cue when done, no audio); the current-step highlight
  moves with Prev/Next or by clicking a header.
- `checklist` — `<ul data-aha="checklist">` with `li` items and empty
  `<li data-group="Label">` group rows. Boxes toggle natively; the
  client keeps the `0 of N` progress count live. State stays in memory
  only: no storage (the sandboxed page forbids it).
