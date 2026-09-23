/**
 * Decision-record styles. An ADR in a hairline box: the chosen option
 * takes an accent edge plus a text marker, consequences carry +/- signs
 * so they read without colour.
 */

export const DECISION_RECORD_CSS = `
.aha-decision { max-width: 100%; border: 1px solid var(--rule); padding: 0.75rem 1rem 1rem; margin: 0 0 var(--unit); }
.aha-decision .aha-title { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; margin: 0 0 0.375rem; }
.aha-decision .dec-head { margin: 0 0 0.75rem; }
.aha-decision .badge { display: inline-block; font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.06em; text-transform: uppercase; padding: 0 0.4em; border: 1px solid currentColor; white-space: nowrap; }
.aha-decision .st-accepted { color: var(--accent); }
.aha-decision .st-proposed { color: var(--muted); }
.aha-decision .st-superseded { color: var(--muted); border-style: dashed; }
.aha-decision .date { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin-left: 0.75em; }
.aha-decision .k { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0.75rem 0 0.375rem; }
.aha-decision .ctx, .aha-decision .dec { margin: 0; max-width: 40rem; }
.aha-decision .opts { list-style: none; margin: 0; padding: 0; }
.aha-decision .opts li { margin: 0 0 0.5rem; padding: 0.375rem 0 0.375rem 0.75rem; border-left: 1px solid var(--rule); }
.aha-decision .opts li:last-child { margin-bottom: 0; }
.aha-decision .opts li.chosen { border-left: 2px solid var(--accent); padding-left: calc(0.75rem - 1px); }
.aha-decision .o-name { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; margin: 0 0 0.125rem; }
.aha-decision .o-name .picked { font-weight: 400; font-size: var(--t-xs); letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); margin-left: 0.5em; }
.aha-decision .o-sum { margin: 0; }
.aha-decision .cons { list-style: none; margin: 0; padding: 0; max-width: 40rem; }
.aha-decision .cons li { margin: 0 0 0.25rem; }
.aha-decision .cons .plus span[aria-hidden] { color: var(--accent); font-family: var(--mono); }
.aha-decision .cons .minus span[aria-hidden] { color: var(--warn); font-family: var(--mono); }
`
