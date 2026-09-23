import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Heatmap styles. A sequential ink scale from faint to near-solid, so it
 * reads in light, dark and print. Empty cells stay blank with a hairline.
 */

export const HEATMAP_CSS = `${CHART_CSS}
.aha-heat .heat-0 { fill: var(--ink); fill-opacity: 0.07; }
.aha-heat .heat-1 { fill: var(--ink); fill-opacity: 0.22; }
.aha-heat .heat-2 { fill: var(--ink); fill-opacity: 0.42; }
.aha-heat .heat-3 { fill: var(--ink); fill-opacity: 0.64; }
.aha-heat .heat-4 { fill: var(--ink); fill-opacity: 0.88; }
.aha-heat .heat-empty { fill: none; stroke: var(--hair); stroke-width: 1; }
.aha-heat .hval { font-family: var(--mono); font-size: 10px; fill: var(--ink); }
.aha-heat .hval.inv { fill: var(--paper); }
.aha-heat rect.on { stroke: var(--accent); stroke-width: 2; }
`
