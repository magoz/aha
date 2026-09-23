import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Histogram styles. Ink bars with a dashed accent marker line.
 */

export const HISTOGRAM_CSS = `${CHART_CSS}
.aha-hist .bar { fill: var(--ink); fill-opacity: 0.82; }
.aha-hist .bar.on { stroke: var(--accent); stroke-width: 2; }
.aha-hist .mark { stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 6 3; }
.aha-hist .mlab { font-family: var(--mono); font-size: 11px; fill: var(--accent); }
`
