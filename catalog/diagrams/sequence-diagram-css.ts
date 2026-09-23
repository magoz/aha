import { DIAGRAM_CSS } from './diagram-css.js'

/**
 * Sequence-diagram styles: dashed lifelines, arrow variants per message
 * kind, numbered mono labels and hairline note boxes.
 */

export const SEQUENCE_DIAGRAM_CSS = `${DIAGRAM_CSS}
.aha-sequence .lane { stroke: var(--rule); stroke-width: 1; stroke-dasharray: 5 4; }
.aha-sequence .mline { stroke: var(--ink); stroke-width: 1; }
.aha-sequence .mline.ret { stroke-dasharray: 6 4; }
.aha-sequence .ahead { fill: none; stroke: var(--ink); stroke-width: 1; }
.aha-sequence .edge.hi .mline { stroke: var(--accent); stroke-width: 2; }
.aha-sequence .edge.hi .ahead { stroke: var(--accent); }
.aha-sequence .edge:focus { outline: none; }
.aha-sequence .edge:focus .mline { stroke: var(--accent); stroke-width: 2; }
.aha-sequence .mlbl { font-family: var(--mono); font-size: 11px; fill: var(--ink); paint-order: stroke; stroke: var(--paper); stroke-width: 3px; }
.aha-sequence { container-type: inline-size; }
@container (max-width: 30rem) {
  .aha-sequence .mlbl { font-size: 10px; }
  .aha-sequence .node .ntext { font-size: 10px; }
  .aha-sequence .snote .ntext { font-size: 10px; }
}
.aha-sequence .edge.hi .mlbl { fill: var(--accent); }
.aha-sequence .snote rect { fill: var(--paper); stroke: var(--rule); stroke-width: 1; }
.aha-sequence .snote .ntext { font-family: var(--mono); font-size: 11px; fill: var(--muted); }
`
