/**
 * Scalable-list styles. A hairline quantity list with tabular figures
 * and a small yield control; the control stays hidden until the client
 * unhides it, so the base yield reads without scripts.
 */

export const SCALABLE_LIST_CSS = `
.aha-scale { max-width: 40rem; }
.aha-scale .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.375rem; }
.aha-scale .sc-yield { font-family: var(--mono); font-size: var(--t-sm); color: var(--muted); margin: 0 0 0.75rem; font-variant-numeric: tabular-nums; }
.aha-scale .sc-ctl { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem; }
.aha-scale .sc-ctl[hidden] { display: none; }
.aha-scale .sc-ctl button { font-family: var(--mono); font-size: var(--t-sm); min-width: 2rem; padding: 0.25rem 0.5rem; border: 1px solid var(--rule); background: none; color: var(--ink); cursor: pointer; font-variant-numeric: tabular-nums; }
.aha-scale .sc-ctl button:hover { border-color: var(--accent); color: var(--accent); }
.aha-scale .sc-ctl output { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); font-variant-numeric: tabular-nums; }
.aha-scale .sc-ctl .presets { display: inline-flex; gap: 0.25rem; }
.aha-scale .sc-items { list-style: none; margin: 0 0 var(--unit); padding: 0; border: 1px solid var(--rule); }
.aha-scale .sc-items > li { display: flex; gap: 0.75rem; align-items: baseline; margin: 0; padding: 0.5rem 1rem; border-bottom: 1px solid var(--hair); }
.aha-scale .sc-items > li:last-child { border-bottom: 0; }
.aha-scale .q { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; white-space: nowrap; flex: none; min-width: 5rem; font-variant-numeric: tabular-nums; }
.aha-scale .q.taste { font-weight: 400; color: var(--muted); }
.aha-scale .n { flex: 1; min-width: 0; }
.aha-scale .n .note { color: var(--muted); font-size: var(--t-sm); }
@media print {
  .aha-scale .sc-ctl { display: none; }
}
`
