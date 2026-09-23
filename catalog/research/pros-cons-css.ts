/**
 * Pros-cons styles. Two hairline columns that stack inside narrow
 * containers (container flow, no viewport queries); weights are small
 * mono markers, never bars.
 */

export const PROS_CONS_CSS = `
.aha-proscons { max-width: 100%; }
.aha-proscons .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-proscons .pc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1px; background: var(--hair); border: 1px solid var(--rule); margin: 0 0 var(--unit); }
.aha-proscons .col { background: var(--paper); padding: 0.625rem 1rem 0.75rem; min-width: 0; }
.aha-proscons .k { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.375rem; }
.aha-proscons .col ul { list-style: none; margin: 0; padding: 0; }
.aha-proscons .col li { display: flex; gap: 0.5rem; align-items: baseline; margin: 0 0 0.375rem; }
.aha-proscons .col li:last-child { margin-bottom: 0; }
.aha-proscons .sign { font-family: var(--mono); color: var(--muted); }
.aha-proscons .tx { flex: 1; min-width: 0; }
.aha-proscons .wt { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); border: 1px solid var(--hair); padding: 0 0.35em; margin-left: 0.5em; white-space: nowrap; }
.aha-proscons .verdict { margin: 0 0 var(--unit); max-width: 40rem; }
.aha-proscons .verdict .k { color: var(--accent); margin-right: 0.5em; }
`
