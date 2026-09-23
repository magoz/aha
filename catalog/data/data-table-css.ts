/**
 * Data-table styles. Numbers right-align with tabular figures; the
 * highlighted row carries the accent edge, matching the house tables.
 */

export const DATA_TABLE_CSS = `
.aha-table { max-width: 100%; container-type: inline-size; }
.aha-table .tw { overflow-x: auto; border: 1px solid var(--rule); }
.aha-table .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-table table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: var(--t-sm); line-height: 1.5; }
.aha-table th, .aha-table td { text-align: left; vertical-align: top; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--hair); overflow-wrap: normal; word-break: normal; }
.aha-table thead th { font-size: var(--t-xs); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--rule); white-space: nowrap; }
.aha-table tbody tr:last-child td { border-bottom: 0; }
.aha-table tr.rec > td:first-child, .aha-table tr.rec > th:first-child { border-left: 2px solid var(--accent); }
.aha-table td.num, .aha-table th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.aha-table td.dt, .aha-table th.dt { white-space: nowrap; }
@container (max-width: 30rem) {
  .aha-table th.low, .aha-table td.low { display: none; }
}
.aha-table th[data-sort] { cursor: pointer; }
.aha-table th[data-sort]:focus { outline: 1px solid var(--accent); outline-offset: -1px; }
.aha-table details.aha-more { margin-top: 0.5rem; }
.aha-table details.aha-more summary { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); cursor: pointer; }
`
