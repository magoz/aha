import { DIAGRAM_CSS } from './diagram-css.js'

/**
 * Tree-diagram styles: connector paths, collapse toggles and edge
 * branch labels on top of the shared diagram kit.
 */

export const TREE_DIAGRAM_CSS = `${DIAGRAM_CSS}
.aha-tree .conn path { fill: none; stroke: var(--ink); stroke-width: 1; }
.aha-tree .conn polygon { fill: var(--ink); stroke: none; }
.aha-tree .tgl { fill: var(--paper); stroke: var(--ink); stroke-width: 1; }
.aha-tree .tglx { font-family: var(--mono); font-size: 11px; fill: var(--ink); }
.aha-tree .tnode { cursor: pointer; }
`
