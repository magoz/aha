/**
 * Claims styles. Findings in a hairline list with a thin bordered mono
 * badge carrying the confidence word plus a glyph, so confidence never
 * depends on colour. Citation links sit inline after the statement.
 */

export const CLAIMS_CSS = `
.aha-claims { max-width: 100%; }
.aha-claims .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-claims .claim-list { list-style: none; margin: 0 0 var(--unit); padding: 0; border: 1px solid var(--rule); }
.aha-claims .claim-list li { margin: 0; padding: 0.625rem 1rem 0.75rem; border-bottom: 1px solid var(--hair); }
.aha-claims .claim-list li:last-child { border-bottom: 0; }
.aha-claims .statement { margin: 0 0 0.375rem; max-width: 40rem; }
.aha-claims .cite { font-family: var(--mono); font-size: var(--t-sm); color: var(--accent); text-decoration: none; white-space: nowrap; }
.aha-claims .cite:hover { text-decoration: underline; }
.aha-claims .conf-row { margin: 0; }
.aha-claims .conf { display: inline-block; font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.06em; text-transform: uppercase; padding: 0 0.4em; border: 1px solid currentColor; white-space: nowrap; }
.aha-claims .conf-high { color: var(--ink); }
.aha-claims .conf-medium { color: var(--muted); }
.aha-claims .conf-low { color: var(--muted); border-style: dashed; }
`
