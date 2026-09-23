/**
 * Side-by-side styles. Two labelled panes in a hairline frame: side
 * by side on wide containers (container query, no viewport rules),
 * stacked on narrow ones. Code panes scroll long lines inside their
 * own box; changed rows pair the accent with a marker glyph.
 */

export const SIDE_BY_SIDE_CSS = `
.aha-sbs { max-width: 100%; container-type: inline-size; margin: 0 0 var(--unit); }
.aha-sbs .panes { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
.aha-sbs .pane { border: 1px solid var(--rule); min-width: 0; }
.aha-sbs .ph { display: flex; flex-wrap: wrap; gap: 0.25rem 0.75rem; align-items: baseline; font-family: var(--mono); font-size: var(--t-sm); margin: 0; padding: 0.5rem 1rem; border-bottom: 1px solid var(--rule); }
.aha-sbs .ph .pl { font-weight: 600; }
.aha-sbs .ph .lg { color: var(--muted); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; }
.aha-sbs .tw { overflow-x: auto; }
.aha-sbs table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: var(--t-sm); line-height: 1.6; }
.aha-sbs td { padding: 0 0.5rem; vertical-align: top; }
.aha-sbs td.no { width: 2.5rem; min-width: 2.5rem; text-align: right; color: var(--muted); font-size: var(--t-xs); line-height: 2.1; user-select: none; }
.aha-sbs td.mk { width: 1.5rem; min-width: 1.5rem; text-align: center; color: var(--muted); user-select: none; }
.aha-sbs td.code { white-space: pre; }
.aha-sbs tr.chg td.mk { color: var(--accent); font-weight: 600; }
.aha-sbs tr.chg td.code { background: var(--hair); }
.aha-sbs .pane.text .tx { padding: 0.75rem 1rem; font-size: var(--t-sm); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.aha-sbs .pane.text .tx:empty { display: none; }
.aha-sbs .vh { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.aha-sbs td.mk:has(.vh), .aha-sbs .pane { position: relative; }
@container (min-width: 42rem) {
  .aha-sbs .panes { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}
@media print {
  .aha-sbs tr.chg td.code { background: none; }
}
`
