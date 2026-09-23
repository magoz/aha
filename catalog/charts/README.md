# Charts

Ten components sharing the kit in `catalog/shared/`: `layoutFrame`,
`renderAxis`, end labels with collision avoidance, `tooltipShell`,
`enhanceChart` interaction (snap-to-nearest tooltip, tap, keyboard,
Escape), and the mono/ink house tokens.

- `line-chart` — multiple series over numeric, time or category x, with
  optional log scales. Labels sit next to their line's end; a leader line
  connects a label only when collision avoidance displaced it.
- `time-strips` — stacked rows sharing one time axis. Every row keeps at
  least two labelled ticks; a `line-bars` row with `barUnit` draws the bar
  channel on a labelled right-hand scale
  (e.g. rain `%` line left, `mm` bars right).
- `bar-chart` — vertical or horizontal, grouped or stacked. Negatives
  diverge from zero; `sorted` reorders categories by total; value labels
  appear when there is room; long category labels wrap or truncate.
- `area-chart` — stacked or overlapping areas over numeric/time x, with
  an optional `percent` 100% share mode.
- `scatter-plot` — x/y with optional size and group encodings, direct
  labels on selected points, an optional least squares `trend` line, and
  log axes.
- `sparkline` — tiny inline trend for prose or tables, with an optional
  last value and min/max markers. Author as a `div` block inside a table
  cell or between paragraphs (a `figure` works too); hover shows values.
- `heatmap` — matrix over two categorical axes with a sequential ink
  scale, a scale legend and cell tooltips; null leaves a cell empty.
- `range-plot` — dumbbell per category: `fromLabel`/`toLabel` (before and
  after, or min and max) with the signed change at the row end.
- `proportion-bar` — one 100% bar or a small set, labelled directly
  inside the segment when there is room, otherwise just outside with a
  connector tick: a stand-in for pie charts.
- `histogram` — binned distribution with automatic nice bins and an
  optional `marker` line, e.g. the median.

Shared-kit notes: `layoutFrame` accepts an optional `margins` override;
`renderAxis` accepts `side: 'left' | 'right'` and `grid: false` for dual
scales; `placeEndLabels` / `renderEndLabels` place direct labels next to
a series end with overflow clamping and leader lines only when displaced;
`ticks.ts` has `ensureTwoTicks` for small multiples. All additions are
backwards compatible: phase-1 callers keep their defaults.
