/**
 * Code-diff styles. Added lines take the accent, removed lines the
 * warning red, and the marker column carries +/- so the diff reads in
 * print and without colour. Long lines scroll inside the wrapper.
 */

export const CODE_DIFF_CSS = `
.aha-diff { max-width: 100%; }
.aha-diff .diff-file { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-diff .tw { overflow-x: auto; border: 1px solid var(--rule); }
.aha-diff table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: var(--t-sm); line-height: 1.6; }
.aha-diff td { padding: 0 0.5rem; vertical-align: top; }
.aha-diff td.no { width: 2.5rem; min-width: 2.5rem; text-align: right; color: var(--muted); font-size: var(--t-xs); line-height: 2.1; user-select: none; }
.aha-diff td.mk { width: 1.5rem; min-width: 1.5rem; text-align: center; color: var(--muted); user-select: none; }
.aha-diff td.code { white-space: pre; }
.aha-diff tr.add td.code, .aha-diff tr.add td.mk { color: var(--accent); }
.aha-diff tr.del td.code, .aha-diff tr.del td.mk { color: var(--warn); }
.aha-diff tr.hunk td.code { color: var(--muted); }
.aha-diff tr.meta td.code { color: var(--muted); }
`
