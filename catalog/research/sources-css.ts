/**
 * Sources styles. A hairline reference list: numbers in mono, the URL
 * visible in mono with its own scroll wrapper, long URLs wrapping
 * anywhere so the page never overflows at 390px.
 */

export const SOURCES_CSS = `
.aha-sources { max-width: 100%; }
.aha-sources .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-sources .src-list { list-style: none; margin: 0 0 var(--unit); padding: 0; border: 1px solid var(--rule); }
.aha-sources .src-list li { margin: 0; padding: 0.625rem 1rem 0.75rem; border-bottom: 1px solid var(--hair); scroll-margin-top: 1rem; }
.aha-sources .src-list li:last-child { border-bottom: 0; }
.aha-sources .src-list li:target { border-left: 2px solid var(--accent); padding-left: calc(1rem - 2px); }
.aha-sources .src-t { font-family: var(--mono); font-size: var(--t-sm); font-weight: 600; margin: 0 0 0.125rem; }
.aha-sources .src-t .n { color: var(--accent); font-weight: 400; margin-right: 0.25em; }
.aha-sources .src-meta { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin: 0 0 0.25rem; }
.aha-sources .src-sup { margin: 0 0 0.25rem; max-width: 40rem; }
.aha-sources .src-url { font-family: var(--mono); font-size: var(--t-xs); margin: 0; overflow-x: auto; overflow-wrap: anywhere; }
.aha-sources .src-url a { color: var(--muted); }
`
