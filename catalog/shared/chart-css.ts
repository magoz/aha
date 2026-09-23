/**
 * Shared chart styles. Charts size to their container (SVG scales by width);
 * no viewport media queries here. Colours come from the page tokens so
 * light, dark and print follow the house style.
 */

export const CHART_CSS = `
.aha-chart { position: relative; container-type: inline-size; max-width: 100%; }
.aha-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.aha-chart .tick { font-family: var(--mono); font-size: 11px; fill: var(--muted); }
.aha-chart .axis-cap { font-family: var(--mono); font-size: 11px; fill: var(--muted); }
.aha-chart .grid { stroke: var(--hair); stroke-width: 1; }
.aha-chart .frame { stroke: var(--rule); stroke-width: 1; fill: none; }
.aha-chart .slabel { font-family: var(--mono); font-size: 11px; fill: var(--muted); cursor: default; }
.aha-chart .slabel.hi { fill: var(--accent); font-weight: 600; }
.aha-chart .leader { stroke: var(--muted); stroke-width: 1; }
.aha-chart .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-chart .series { fill: none; stroke: var(--ink); stroke-width: 1.5; }
.aha-chart .series .mk { fill: var(--paper); stroke: inherit; stroke-width: 1.5; }
.aha-chart .series.ls-1 { stroke-opacity: 0.55; }
.aha-chart .series.ls-2 { stroke-opacity: 0.75; }
.aha-chart .series.ls-3 { stroke-opacity: 0.9; }
.aha-chart .series.hi { stroke: var(--accent); stroke-width: 2.25; }
.aha-chart .series.hi .mk { fill: var(--accent); stroke: var(--accent); }
.aha-chart svg.dim .series { opacity: 0.25; }
.aha-chart svg.dim .series.hot { opacity: 1; }
.aha-chart .mk.on { stroke: var(--accent); stroke-width: 2.5; }
.aha-chart .bar { stroke: none; }
.aha-chart .band { stroke: none; opacity: 0.18; }
.aha-chart .aha-tip { position: absolute; z-index: 2; max-width: 16rem; padding: 0.4rem 0.6rem; border: 1px solid var(--rule); background: var(--paper); font-family: var(--mono); font-size: var(--t-xs); line-height: 1.5; pointer-events: none; }
.aha-chart .aha-tip b { font-weight: 600; }
.aha-chart .aha-tip .hv { color: var(--accent); font-weight: 600; }
.aha-chart details.aha-values { margin-top: 0.75rem; font-size: var(--t-sm); }
.aha-scroll { max-width: 100%; overflow-x: auto; }
.aha-chart details.aha-values summary { font-family: var(--mono); font-size: var(--t-xs); color: var(--muted); cursor: pointer; }
.aha-chart details.aha-values table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: var(--t-xs); margin-top: 0.5rem; }
.aha-chart details.aha-values th, .aha-chart details.aha-values td { text-align: left; padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--hair); }
.aha-chart details.aha-values td.num, .aha-chart details.aha-values th.num { text-align: right; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  .aha-chart * { transition: none; animation: none; }
}
`
