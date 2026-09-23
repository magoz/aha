/**
 * Risk-matrix styles. A small 5-by-5 grid with numbered mono markers
 * plus the full-text list below. The grid uses fractional columns so it
 * stays readable at 390px; the marker/row highlight is an accent edge,
 * never a fill.
 */

export const RISK_MATRIX_CSS = `
.aha-risk { max-width: 100%; }
.aha-risk .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-risk .rm-grid { display: grid; grid-template-columns: auto repeat(5, 1fr); gap: 1px; background: var(--hair); border: 1px solid var(--rule); max-width: 28rem; }
.aha-risk .rm-corner { background: var(--paper); min-height: 1.5rem; }
.aha-risk .rm-ax { background: var(--paper); font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); display: flex; align-items: center; justify-content: center; padding: 0.25rem; min-height: 1.5rem; }
.aha-risk .rm-cell { background: var(--paper); display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; justify-content: center; padding: 0.375rem 0.25rem; min-height: 2.25rem; }
.aha-risk .mk { font-family: var(--mono); font-size: var(--t-xs); line-height: 1.6; min-width: 1.4em; text-align: center; border: 1px solid var(--muted); cursor: default; }
.aha-risk .mk:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.aha-risk .mk.hot { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.aha-risk .rm-axes { display: flex; gap: 1.5rem; font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin: 0.375rem 0 0.75rem; }
.aha-risk .risk-list { list-style: none; margin: 0 0 var(--unit); padding: 0; border: 1px solid var(--rule); }
.aha-risk .risk-list li { margin: 0; padding: 0.625rem 1rem 0.75rem 0.875rem; border-bottom: 1px solid var(--hair); border-left: 2px solid transparent; }
.aha-risk .risk-list li:last-child { border-bottom: 0; }
.aha-risk .risk-list li.hot { border-left-color: var(--accent); }
.aha-risk .risk-list li:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
.aha-risk .r-t { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; margin: 0 0 0.125rem; }
.aha-risk .r-t .n { color: var(--accent); font-weight: 400; margin-right: 0.25em; }
.aha-risk .r-score { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin: 0 0 0.25rem; }
.aha-risk .r-mit, .aha-risk .r-own { margin: 0 0 0.125rem; }
.aha-risk .r-mit .k, .aha-risk .r-own .k { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-right: 0.5em; }
`
