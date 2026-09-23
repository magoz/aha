import { DIAGRAM_CSS } from './diagram-css.js'

/**
 * State-diagram styles: the start dot and double-bordered final states
 * on top of the shared diagram kit.
 */

export const STATE_DIAGRAM_CSS = `${DIAGRAM_CSS}
.aha-state .sdot { fill: var(--ink); stroke: none; }
.aha-state .node .nfinal { fill: none; stroke: var(--ink); stroke-width: 1; }
.aha-state .node.hi .nfinal { stroke: var(--accent); }
.aha-state .node:focus .nfinal { stroke: var(--accent); }
`
