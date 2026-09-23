import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Proportion-bar styles. Segments default to ink shades with paper
 * dividers; the accent is reserved for the highlighted part. The muted
 * palette is the documented opt-in exception, with light and dark
 * variants.
 */

export const PROPORTION_BAR_CSS = `${CHART_CSS}
.aha-prop .seg { fill: var(--ink); stroke: var(--paper); stroke-width: 1.5; }
.aha-prop .seg.s-1 { fill-opacity: 0.55; }
.aha-prop .seg.s-2 { fill-opacity: 0.75; }
.aha-prop .seg.s-3 { fill-opacity: 0.9; }
.aha-prop .seg.hi { fill: var(--accent); fill-opacity: 1; }
.aha-prop .seg.cat-0 { fill: #4a6b4f; fill-opacity: 1; }
.aha-prop .seg.cat-1 { fill: #9a7b2d; fill-opacity: 1; }
.aha-prop .seg.cat-2 { fill: #a44a2a; fill-opacity: 1; }
.aha-prop .seg.cat-3 { fill: #4a6b8a; fill-opacity: 1; }
.aha-prop .seg.cat-4 { fill: #3e7a78; fill-opacity: 1; }
.aha-prop .seg.cat-5 { fill: #7a5c48; fill-opacity: 1; }
.aha-prop .seg.on { stroke: var(--accent); stroke-width: 2.5; }
.aha-prop .plab { font-family: var(--mono); font-size: 11px; fill: var(--muted); }
.aha-prop .plab.inv { fill: var(--paper); }
.aha-prop .tick-line { stroke: var(--muted); stroke-width: 1; }
@media (prefers-color-scheme: dark) {
  .aha-prop .seg.cat-0 { fill: #8fbf98; }
  .aha-prop .seg.cat-1 { fill: #d3b25f; }
  .aha-prop .seg.cat-2 { fill: #e08a63; }
  .aha-prop .seg.cat-3 { fill: #8fb8d8; }
  .aha-prop .seg.cat-4 { fill: #7fc4c0; }
  .aha-prop .seg.cat-5 { fill: #c2a284; }
}
`
