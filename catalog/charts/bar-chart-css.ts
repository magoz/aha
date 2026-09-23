import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Bar-chart styles. Bars default to ink shades; the accent is reserved
 * for the highlighted series. The muted palette is the documented opt-in
 * exception for many-series charts, with light and dark variants.
 */

export const BAR_CHART_CSS = `${CHART_CSS}
.aha-bars .bar { fill: var(--ink); }
.aha-bars .bar.s-1 { fill-opacity: 0.55; }
.aha-bars .bar.s-2 { fill-opacity: 0.75; }
.aha-bars .bar.s-3 { fill-opacity: 0.9; }
.aha-bars .bar.hi { fill: var(--accent); fill-opacity: 1; }
.aha-bars .bar.cat-0 { fill: #4a6b4f; fill-opacity: 1; }
.aha-bars .bar.cat-1 { fill: #9a7b2d; fill-opacity: 1; }
.aha-bars .bar.cat-2 { fill: #a44a2a; fill-opacity: 1; }
.aha-bars .bar.cat-3 { fill: #4a6b8a; fill-opacity: 1; }
.aha-bars .bar.cat-4 { fill: #3e7a78; fill-opacity: 1; }
.aha-bars .bar.cat-5 { fill: #7a5c48; fill-opacity: 1; }
.aha-bars .zero { stroke: var(--rule); stroke-width: 1; }
.aha-bars .vlab { font-family: var(--mono); font-size: 10px; fill: var(--muted); }
.aha-bars rect.bar.on { stroke: var(--accent); stroke-width: 2; }
@media (prefers-color-scheme: dark) {
  .aha-bars .bar.cat-0 { fill: #8fbf98; }
  .aha-bars .bar.cat-1 { fill: #d3b25f; }
  .aha-bars .bar.cat-2 { fill: #e08a63; }
  .aha-bars .bar.cat-3 { fill: #8fb8d8; }
  .aha-bars .bar.cat-4 { fill: #7fc4c0; }
  .aha-bars .bar.cat-5 { fill: #c2a284; }
}
`
