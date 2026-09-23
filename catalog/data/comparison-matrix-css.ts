/**
 * Comparison-matrix styles. The criterion column sticks inside the
 * horizontal scroll wrapper; the recommended option takes the accent.
 * Marks read as glyphs plus visually-hidden words, never colour alone.
 */

export const COMPARISON_MATRIX_CSS = `
.aha-matrix { max-width: 100%; }
.aha-matrix .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-matrix .tw-wrap { position: relative; }
.aha-matrix .tw { overflow-x: auto; border: 1px solid var(--rule); }
.aha-matrix .edge { position: absolute; top: 1px; right: 1px; bottom: 1px; width: 2.5rem; background: linear-gradient(to left, var(--paper), transparent); pointer-events: none; }
.aha-matrix table { border-collapse: collapse; width: 100%; table-layout: auto; font-family: var(--mono); font-size: var(--t-sm); line-height: 1.5; }
.aha-matrix th, .aha-matrix td { text-align: left; vertical-align: top; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--hair); max-width: 12rem; overflow-wrap: break-word; word-break: normal; }
.aha-matrix thead th { font-size: var(--t-xs); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--rule); }
.aha-matrix thead th.rec { color: var(--accent); border-bottom: 2px solid var(--accent); }
.aha-matrix tbody tr:last-child th, .aha-matrix tbody tr:last-child td { border-bottom: 0; }
.aha-matrix tbody th[scope="row"] { position: sticky; left: 0; background: var(--paper); border-right: 1px solid var(--rule); font-weight: 500; max-width: 10rem; }
.aha-matrix thead th:first-child { position: sticky; left: 0; background: var(--paper); border-right: 1px solid var(--rule); }
.aha-matrix td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.aha-matrix td.num .unit { color: var(--muted); }
.aha-matrix td.mk { white-space: nowrap; }
.aha-matrix td.mk-yes { color: var(--ink); font-weight: 600; }
.aha-matrix td.mk-part { color: var(--ink); }
.aha-matrix td.mk-no { color: var(--muted); }
.aha-matrix td:has(.vh), .aha-matrix th:has(.vh) { position: relative; }
.aha-matrix .vh { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`
