/**
 * Schema-table styles. A mono field table with dotted paths, depth
 * indentation and a muted description column. The table scrolls inside
 * its wrapper on narrow containers; required reads as a word, never
 * colour alone.
 */

export const SCHEMA_TABLE_CSS = `
.aha-schema { max-width: 100%; }
.aha-schema .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-schema .tw { overflow-x: auto; border: 1px solid var(--rule); }
.aha-schema table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: var(--t-sm); line-height: 1.5; }
.aha-schema th, .aha-schema td { text-align: left; vertical-align: top; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--hair); }
.aha-schema thead th { font-size: var(--t-xs); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--rule); white-space: nowrap; }
.aha-schema tbody tr:last-child th, .aha-schema tbody tr:last-child td { border-bottom: 0; }
.aha-schema th.fld { font-weight: 600; white-space: nowrap; }
.aha-schema th.fld.d1 { padding-left: 1.75rem; }
.aha-schema th.fld.d2 { padding-left: 2.75rem; }
.aha-schema th.fld.d3 { padding-left: 3.75rem; }
.aha-schema td.typ { white-space: nowrap; color: var(--muted); }
.aha-schema td.req { white-space: nowrap; }
.aha-schema .req-y { color: var(--ink); font-weight: 600; }
.aha-schema .req-n { color: var(--muted); }
.aha-schema td.def { white-space: nowrap; color: var(--muted); }
.aha-schema td.desc { min-width: 12rem; }
.aha-schema td.ex code { padding: 0 0.25em; border: 1px solid var(--hair); font-size: 0.875em; white-space: nowrap; }
`
