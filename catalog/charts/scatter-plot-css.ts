import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Scatter-plot styles. Dots default to ink shades with distinct glyphs
 * per group anchor; the trend line is a thin muted rule. The muted
 * palette is the documented opt-in exception, with light and dark
 * variants.
 */

export const SCATTER_PLOT_CSS = `${CHART_CSS}
.aha-scatter .dot { fill: var(--ink); stroke: var(--paper); stroke-width: 1; }
.aha-scatter .dot.s-1 { fill-opacity: 0.55; }
.aha-scatter .dot.s-2 { fill-opacity: 0.75; }
.aha-scatter .dot.s-3 { fill-opacity: 0.9; }
.aha-scatter .dot.cat-0 { fill: #4a6b4f; fill-opacity: 1; }
.aha-scatter .dot.cat-1 { fill: #9a7b2d; fill-opacity: 1; }
.aha-scatter .dot.cat-2 { fill: #a44a2a; fill-opacity: 1; }
.aha-scatter .dot.cat-3 { fill: #4a6b8a; fill-opacity: 1; }
.aha-scatter .dot.cat-4 { fill: #3e7a78; fill-opacity: 1; }
.aha-scatter .dot.cat-5 { fill: #7a5c48; fill-opacity: 1; }
.aha-scatter .dot.on { stroke: var(--accent); stroke-width: 2.5; }
.aha-scatter .trend { stroke: var(--muted); stroke-width: 1.25; stroke-dasharray: 6 3; }
@media (prefers-color-scheme: dark) {
  .aha-scatter .dot.cat-0 { fill: #8fbf98; }
  .aha-scatter .dot.cat-1 { fill: #d3b25f; }
  .aha-scatter .dot.cat-2 { fill: #e08a63; }
  .aha-scatter .dot.cat-3 { fill: #8fb8d8; }
  .aha-scatter .dot.cat-4 { fill: #7fc4c0; }
  .aha-scatter .dot.cat-5 { fill: #c2a284; }
}
`
