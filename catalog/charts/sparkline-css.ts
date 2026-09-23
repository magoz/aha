import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Sparkline styles. Minimal chrome: a hairline trend, ink min/max dots
 * and an accent last dot, with the last value as mono text.
 */

export const SPARKLINE_CSS = `${CHART_CSS}
.aha-spark { position: relative; display: inline-flex; align-items: center; gap: 0.4rem; max-width: 100%; }
.aha-spark svg { display: block; width: 7.5rem; max-width: 100%; height: auto; overflow: visible; }
.aha-spark .spark-line { fill: none; stroke: var(--ink); stroke-width: 1.25; }
.aha-spark .spark-min, .aha-spark .spark-max { fill: var(--paper); stroke: var(--muted); stroke-width: 1.25; }
.aha-spark .spark-last { fill: var(--accent); stroke: var(--accent); }
.aha-spark .sv { font-family: var(--mono); font-size: var(--t-sm); white-space: nowrap; }
`
