import { DIAGRAM_CSS } from './diagram-css.js'

/**
 * Timeline styles: hairline bars, diamond milestones, the dashed today
 * line and wrapped phase labels.
 */

export const TIMELINE_CSS = `${DIAGRAM_CSS}
.aha-timeline .tick { font-family: var(--mono); font-size: 11px; fill: var(--muted); }
.aha-timeline .grid { stroke: var(--hair); stroke-width: 1; }
.aha-timeline .axis { stroke: var(--rule); stroke-width: 1; }
.aha-timeline .bar { fill: var(--paper); stroke: var(--ink); stroke-width: 1; }
.aha-timeline .bar.hi { stroke: var(--accent); stroke-width: 2; }
.aha-timeline .blbl { font-family: var(--mono); font-size: 11px; fill: var(--ink); paint-order: stroke; stroke: var(--paper); stroke-width: 3px; }
.aha-timeline .blbl.hi { fill: var(--accent); }
.aha-timeline .ms { fill: var(--paper); stroke: var(--ink); stroke-width: 1; }
.aha-timeline .mlbl { font-family: var(--mono); font-size: 11px; fill: var(--muted); paint-order: stroke; stroke: var(--paper); stroke-width: 3px; }
.aha-timeline .today { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 5 4; }
.aha-timeline .todaylbl { font-family: var(--mono); font-size: 11px; fill: var(--accent); }
`
