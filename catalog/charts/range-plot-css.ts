import { CHART_CSS } from '../shared/chart-css.js'

/**
 * Range-plot styles. Hollow before-dot, solid after-dot, hairline
 * connector; the accent is reserved for highlighted rows.
 */

export const RANGE_PLOT_CSS = `${CHART_CSS}
.aha-range .rng { stroke: var(--ink); stroke-width: 1.5; }
.aha-range .rng.open { fill: var(--paper); }
.aha-range .rng.shut { fill: var(--ink); }
.aha-range .rng.hi { stroke: var(--accent); }
.aha-range .rng.hi.open { fill: var(--paper); }
.aha-range .rng.hi.shut { fill: var(--accent); }
.aha-range .rng.on { stroke-width: 2.5; }
.aha-range .dl { font-family: var(--mono); font-size: 11px; fill: var(--muted); font-variant-numeric: tabular-nums; }
.aha-range .dl.hi { fill: var(--accent); font-weight: 600; }
`
