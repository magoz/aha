/**
 * Fact-set styles. A hairline key-value sheet in the key-figures idiom:
 * dividers come from a 1px gap over a hairline background, so one or two
 * fact columns stay sharp. Wide containers get two fact columns through
 * a container query, never a viewport query.
 */

export const FACT_SET_CSS = `
.aha-facts { max-width: 100%; container-type: inline-size; }
.aha-facts .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-facts dl.facts { display: grid; grid-template-columns: auto 1fr; gap: 1px; background: var(--hair); border: 1px solid var(--rule); margin: 0 0 var(--unit); padding: 0; }
.aha-facts dl.facts dt { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); background: var(--paper); padding: 0.5rem 0.75rem 0.5rem 1rem; margin: 0; white-space: nowrap; }
.aha-facts dl.facts dd { font-family: var(--mono); font-size: var(--t-sm); background: var(--paper); margin: 0; padding: 0.5rem 1rem 0.5rem 0.75rem; min-width: 0; overflow-wrap: anywhere; }
.aha-facts dl.facts dd .v { font-variant-numeric: tabular-nums; }
.aha-facts dl.facts dd .unit { color: var(--muted); margin-left: 0.25em; }
.aha-facts dl.facts dd .note { display: block; font-size: var(--t-xs); color: var(--muted); margin-top: 0.125rem; }
.aha-facts dl.facts .fill { display: none; }
.aha-facts .g-name { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; margin: 1rem 0 0.5rem; }
.aha-facts .f-group:first-of-type .g-name { margin-top: 0; }
@container (min-width: 34rem) {
  .aha-facts dl.facts { grid-template-columns: auto 1fr auto 1fr; }
  .aha-facts dl.facts .fill { display: block; }
}
`
