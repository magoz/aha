/**
 * Status-list styles. A hairline task list in the house idiom: mono
 * glyph plus status word, so state never depends on colour. Doing takes
 * the accent, blocked the warning red.
 */

export const STATUS_LIST_CSS = `
.aha-status { max-width: 40rem; }
.aha-status .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.375rem; }
.aha-status .sum { font-family: var(--mono); font-size: var(--t-sm); color: var(--muted); margin: 0 0 0.75rem; font-variant-numeric: tabular-nums; }
.aha-status .st-tasks { list-style: none; margin: 0 0 var(--unit); padding: 0; border: 1px solid var(--rule); }
.aha-status .st-tasks > li { display: flex; gap: 0.75rem; align-items: baseline; margin: 0; padding: 0.5rem 1rem; border-bottom: 1px solid var(--hair); }
.aha-status .st-tasks > li:last-child { border-bottom: 0; }
.aha-status .st-group { margin-bottom: var(--unit); }
.aha-status .st-group:last-child { margin-bottom: var(--unit); }
.aha-status .g-name { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; margin: 1rem 0 0.5rem; }
.aha-status .st-group:first-of-type .g-name { margin-top: 0; }
.aha-status .g-name .g-count { font-weight: 400; font-size: var(--t-xs); color: var(--muted); margin-left: 0.5em; white-space: nowrap; }
.aha-status .glyph { font-family: var(--mono); font-size: var(--t-sm); white-space: nowrap; }
.aha-status .body { flex: 1; min-width: 0; }
.aha-status .body .t { font-weight: 600; }
.aha-status .st-doing .body .t { font-weight: 600; }
.aha-status .st-done .glyph { color: var(--ink); }
.aha-status .st-doing .glyph, .aha-status .st-doing .st-word { color: var(--accent); }
.aha-status .st-blocked .glyph, .aha-status .st-blocked .st-word { color: var(--warn); }
.aha-status .st-todo .glyph { color: var(--muted); }
.aha-status .st-word { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-left: 0.5em; white-space: nowrap; }
.aha-status .meta { display: block; font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin-top: 0.125rem; }
.aha-status .note { display: block; font-size: var(--t-sm); color: var(--muted); margin-top: 0.125rem; }
.aha-status .st-done .body .t { font-weight: 400; }
`
