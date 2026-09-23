/**
 * Shared diagram styles. Square 1px boxes, polygon arrowheads, mono
 * labels and a single accent for highlights; page tokens carry light,
 * dark and print. Per-component files extend this, never replace it.
 */

export const DIAGRAM_CSS = `
.aha-diagram { position: relative; container-type: inline-size; max-width: 100%; }
.aha-diagram svg { display: block; width: 100%; height: auto; overflow: visible; }
.aha-diagram .dtitle { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-diagram .node { cursor: default; }
.aha-diagram .node .nrect { fill: var(--paper); stroke: var(--ink); stroke-width: 1; }
.aha-diagram .node .ntext { font-family: var(--mono); font-size: 11px; fill: var(--ink); }
.aha-diagram .node.hi .nrect { stroke: var(--accent); stroke-width: 2; }
.aha-diagram .node.hi .ntext { fill: var(--accent); font-weight: 600; }
.aha-diagram .node:focus { outline: none; }
.aha-diagram .node:focus .nrect { stroke: var(--accent); stroke-width: 2; }
.aha-diagram .edge path { fill: none; stroke: var(--ink); stroke-width: 1; }
.aha-diagram .edge polygon { fill: var(--ink); stroke: none; }
.aha-diagram .edge.hi path { stroke: var(--accent); stroke-width: 2; }
.aha-diagram .edge.hi polygon { fill: var(--accent); }
.aha-diagram .elbl { font-family: var(--mono); font-size: 11px; fill: var(--muted); paint-order: stroke; stroke: var(--paper); stroke-width: 3px; }
.aha-diagram .grp rect { fill: none; stroke: var(--rule); stroke-width: 1; }
.aha-diagram .grp text { font-family: var(--mono); font-size: 11px; fill: var(--muted); paint-order: stroke; stroke: var(--paper); stroke-width: 3px; }
.aha-diagram svg.has-sel .node, .aha-diagram svg.has-sel .edge { opacity: 0.3; }
.aha-diagram svg.has-sel .node.hot, .aha-diagram svg.has-sel .edge.hot { opacity: 1; }
.aha-diagram svg.has-sel .node.hot .nrect { stroke: var(--accent); stroke-width: 2; }
.aha-diagram svg.has-sel .edge.hot path { stroke: var(--accent); stroke-width: 2; }
.aha-diagram svg.has-sel .edge.hot polygon { fill: var(--accent); }
.aha-diagram .swrap { overflow-x: auto; max-width: 100%; }
.aha-diagram details.aha-values { margin-top: 0.75rem; font-size: var(--t-sm); }
.aha-diagram details.aha-values summary { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); cursor: pointer; }
.aha-diagram details.aha-values table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: var(--t-xs); margin-top: 0.5rem; }
.aha-diagram details.aha-values th, .aha-diagram details.aha-values td { text-align: left; padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--hair); }
.aha-diagram details.aha-values th { font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
@media (prefers-reduced-motion: reduce) {
  .aha-diagram * { transition: none; animation: none; }
}
`
