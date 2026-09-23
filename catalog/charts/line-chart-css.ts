import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Line-chart styles. Series default to ink shades, dash patterns and marker
 * glyphs; the accent is reserved for the highlighted series. The muted
 * palette is the documented opt-in exception for many-series charts, with
 * light and dark variants.
 */

export const LINE_CHART_CSS = `${CHART_CSS}
.aha-line-chart .series.cat-0 { stroke: #4a6b4f; }
.aha-line-chart .series.cat-1 { stroke: #9a7b2d; }
.aha-line-chart .series.cat-2 { stroke: #a44a2a; }
.aha-line-chart .series.cat-3 { stroke: #4a6b8a; }
.aha-line-chart .series.cat-4 { stroke: #3e7a78; }
.aha-line-chart .series.cat-5 { stroke: #7a5c48; }
.aha-line-chart .series.cat-0 .mk, .aha-line-chart .series.cat-1 .mk, .aha-line-chart .series.cat-2 .mk, .aha-line-chart .series.cat-3 .mk, .aha-line-chart .series.cat-4 .mk, .aha-line-chart .series.cat-5 .mk { fill: var(--paper); }
@media (prefers-color-scheme: dark) {
  .aha-line-chart .series.cat-0 { stroke: #8fbf98; }
  .aha-line-chart .series.cat-1 { stroke: #d3b25f; }
  .aha-line-chart .series.cat-2 { stroke: #e08a63; }
  .aha-line-chart .series.cat-3 { stroke: #8fb8d8; }
  .aha-line-chart .series.cat-4 { stroke: #7fc4c0; }
  .aha-line-chart .series.cat-5 { stroke: #c2a284; }
}
`
