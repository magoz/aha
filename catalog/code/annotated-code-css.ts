/**
 * Annotated-code styles. A code table with line numbers and note
 * markers beside a numbered note list: stacked by default, beside the
 * code on wide containers (container query, no viewport rules). Long
 * lines scroll inside the code box. Highlight pairs markers with the
 * accent plus a note rule, never colour alone.
 */

export const ANNOTATED_CODE_CSS = `
.aha-ancode { max-width: 100%; container-type: inline-size; }
.aha-ancode .ahead { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; align-items: baseline; font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-ancode .ahead .afile { font-weight: 600; }
.aha-ancode .ahead .alng { color: var(--muted); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; }
.aha-ancode .abody { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; align-items: start; }
.aha-ancode .tw { overflow-x: auto; border: 1px solid var(--rule); margin: 0; }
.aha-ancode table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: var(--t-sm); line-height: 1.6; }
.aha-ancode td { padding: 0 0.5rem; vertical-align: top; }
.aha-ancode td.no { width: 2.5rem; min-width: 2.5rem; text-align: right; color: var(--muted); font-size: var(--t-xs); line-height: 2.1; user-select: none; }
.aha-ancode td.mk { white-space: nowrap; color: var(--muted); user-select: none; }
.aha-ancode td.code { white-space: pre; }
.aha-ancode tr.hl td.mk { color: var(--accent); font-weight: 600; }
.aha-ancode tr.hl td.no { color: var(--accent); }
.aha-ancode tr.hl td.code { background: var(--hair); }
.aha-ancode .notes { list-style: none; margin: 0; padding: 0; }
.aha-ancode .notes li { margin: 0 0 0.75rem; padding: 0.25rem 0 0.25rem 0.75rem; border-left: 2px solid var(--hair); }
.aha-ancode .notes li:last-child { margin-bottom: 0; }
.aha-ancode .notes li.hl { border-left-color: var(--accent); }
.aha-ancode .notes li:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }
.aha-ancode .nhead { display: block; font-family: var(--mono); font-size: var(--t-sm); margin-bottom: 0.25rem; }
.aha-ancode .nhead .n { color: var(--accent); font-weight: 600; }
.aha-ancode .nhead .nt { font-weight: 600; }
.aha-ancode .nhead .nl { color: var(--muted); font-size: var(--t-xs); white-space: nowrap; }
.aha-ancode .notes p { font-size: var(--t-sm); margin: 0; max-width: none; }
@container (min-width: 44rem) {
  .aha-ancode .abody { grid-template-columns: minmax(0, 1.6fr) minmax(12rem, 1fr); }
}
@media print {
  .aha-ancode tr.hl td.code { background: none; }
}
`
