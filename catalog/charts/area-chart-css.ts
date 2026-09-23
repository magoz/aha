import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Area-chart styles. Areas default to ink shades at low fill opacity with
 * a solid edge; the accent is reserved for the highlighted series. The
 * muted palette is the documented opt-in exception, with light and dark
 * variants.
 */

export const AREA_CHART_CSS = `${CHART_CSS}
.aha-area .area { fill: var(--ink); fill-opacity: 0.14; stroke: var(--ink); stroke-width: 1.5; }
.aha-area .area.fill { stroke: none; }
.aha-area .area.s-1 { fill-opacity: 0.1; stroke-opacity: 0.55; }
.aha-area .area.s-2 { fill-opacity: 0.12; stroke-opacity: 0.75; }
.aha-area .area.s-3 { fill-opacity: 0.13; stroke-opacity: 0.9; }
.aha-area .area.hi { fill: var(--accent); fill-opacity: 0.18; stroke: var(--accent); stroke-width: 2.25; }
.aha-area .area.cat-0 { fill: #4a6b4f; stroke: #4a6b4f; }
.aha-area .area.cat-1 { fill: #9a7b2d; stroke: #9a7b2d; }
.aha-area .area.cat-2 { fill: #a44a2a; stroke: #a44a2a; }
.aha-area .area.cat-3 { fill: #4a6b8a; stroke: #4a6b8a; }
.aha-area .area.cat-4 { fill: #3e7a78; stroke: #3e7a78; }
.aha-area .area.cat-5 { fill: #7a5c48; stroke: #7a5c48; }
@media (prefers-color-scheme: dark) {
  .aha-area .area.cat-0 { fill: #8fbf98; stroke: #8fbf98; }
  .aha-area .area.cat-1 { fill: #d3b25f; stroke: #d3b25f; }
  .aha-area .area.cat-2 { fill: #e08a63; stroke: #e08a63; }
  .aha-area .area.cat-3 { fill: #8fb8d8; stroke: #8fb8d8; }
  .aha-area .area.cat-4 { fill: #7fc4c0; stroke: #7fc4c0; }
  .aha-area .area.cat-5 { fill: #c2a284; stroke: #c2a284; }
}
`
