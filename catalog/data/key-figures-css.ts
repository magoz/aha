/**
 * Key-figures styles. A hairline grid of mono headline numbers: dividers
 * come from a 1px gap over a hairline background, so any column count
 * stays sharp. No viewport queries; the grid reflows by container width.
 */

export const KEY_FIGURES_CSS = `
.aha-figures { max-width: 100%; }
.aha-figures .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-figures .fig-grid { list-style: none; margin: 0 0 var(--unit); padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 1px; background: var(--hair); border: 1px solid var(--rule); }
.aha-figures .fig-grid li { background: var(--paper); padding: 0.75rem 1rem 0.875rem; margin: 0; min-width: 0; }
.aha-figures .k-label { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.375rem; }
.aha-figures .k-value { font-family: var(--mono); font-size: var(--t-lg); font-weight: 600; line-height: 1.2; margin: 0; font-variant-numeric: tabular-nums; white-space: nowrap; }
.aha-figures .k-value .unit { font-size: var(--t-sm); font-weight: 400; color: var(--muted); margin-left: 0.25em; }
.aha-figures .delta { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin: 0.375rem 0 0; white-space: nowrap; }
.aha-figures .delta .arr { color: var(--ink); }
.aha-figures .spark { display: block; width: 100%; max-width: 8rem; height: 1.5rem; margin-top: 0.5rem; overflow: visible; }
.aha-figures .spark path { fill: none; stroke: var(--muted); stroke-width: 1; vector-effect: non-scaling-stroke; }
`
