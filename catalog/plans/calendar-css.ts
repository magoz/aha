/**
 * Calendar styles. A hairline month grid with kind labels and CSS-only
 * event details (hover or keyboard focus); narrow containers swap the
 * grid for an agenda list through a container query, never a viewport
 * query. The week strip scrolls inside its own box.
 */

export const CALENDAR_CSS = `
.aha-cal { position: relative; max-width: 100%; container-type: inline-size; }
.aha-cal .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-cal .cal-grid { border-collapse: collapse; width: 100%; table-layout: fixed; border: 1px solid var(--rule); }
.aha-cal .cal-grid th { font-family: var(--mono); font-size: var(--t-xs); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 0.375rem 0.25rem; border-bottom: 1px solid var(--rule); text-align: left; }
.aha-cal .cal-grid td.day { vertical-align: top; height: 4.5rem; padding: 0.25rem 0.375rem 0.375rem; border-bottom: 1px solid var(--hair); border-right: 1px solid var(--hair); overflow-wrap: anywhere; }
.aha-cal .cal-grid tbody tr:last-child td.day { border-bottom: 0; }
.aha-cal .cal-grid tr td.day:last-child { border-right: 0; }
.aha-cal .dnum { display: block; font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); margin-bottom: 0.25rem; font-variant-numeric: tabular-nums; }
.aha-cal td.out .dnum { opacity: 0.55; }
.aha-cal td.today .dnum { color: var(--accent); font-weight: 600; }
.aha-cal .td { font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; }
.aha-cal .ev { position: relative; display: block; font-family: var(--mono); font-size: var(--t-xs); line-height: 1.45; border-left: 2px solid var(--ink); padding: 0.0625rem 0 0.0625rem 0.375rem; margin: 0 0 0.25rem; cursor: default; }
.aha-cal .ev.cont { border-left-style: dashed; }
.aha-cal .ev-k { color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
.aha-cal .ev-d { display: none; position: absolute; z-index: 2; left: 0; top: 100%; min-width: 10rem; max-width: 14rem; background: var(--paper); border: 1px solid var(--rule); padding: 0.375rem 0.5rem; color: var(--ink); white-space: normal; }
.aha-cal .ev:hover .ev-d, .aha-cal .ev:focus-visible .ev-d, .aha-cal .ev:focus-within .ev-d { display: block; }
.aha-cal.js .ev .ev-d { display: none; }
.aha-cal .cal-tip { position: absolute; z-index: 3; max-width: 16rem; padding: 0.375rem 0.5rem; background: var(--paper); border: 1px solid var(--rule); font-family: var(--mono); font-size: var(--t-xs); line-height: 1.5; color: var(--ink); pointer-events: none; }
.aha-cal .ev:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.aha-cal .cal-agenda { display: none; list-style: none; margin: 0 0 var(--unit); padding: 0; border: 1px solid var(--rule); }
.aha-cal .cal-agenda > li { display: flex; gap: 0.75rem; align-items: baseline; margin: 0; padding: 0.5rem 1rem; border-bottom: 1px solid var(--hair); }
.aha-cal .cal-agenda > li:last-child { border-bottom: 0; }
.aha-cal .ad-date { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); white-space: nowrap; flex: none; min-width: 5.5rem; }
.aha-cal .ad-body { flex: 1; min-width: 0; }
.aha-cal .ad-t { font-weight: 600; }
.aha-cal .ad-k { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.aha-cal .ad-r { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); white-space: nowrap; }
.aha-cal .ad-n { display: block; font-size: var(--t-sm); color: var(--muted); }
.aha-cal .tw { overflow-x: auto; border: 1px solid var(--rule); }
.aha-cal .cal-strip { display: grid; gap: 1px; background: var(--hair); min-width: 30rem; }
.aha-cal .strip-day { background: var(--paper); padding: 0.5rem 0.625rem 0.75rem; min-width: 0; }
.aha-cal .sd-h { font-family: var(--mono); font-size: var(--t-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 0.375rem; }
.aha-cal .strip-day.today .sd-h { color: var(--accent); font-weight: 600; }
@container (max-width: 26rem) {
  .aha-cal .cal-grid { display: none; }
  .aha-cal .cal-agenda { display: block; }
}
@media print {
  .aha-cal .cal-grid { display: table; }
  .aha-cal .cal-agenda { display: none; }
}
`
