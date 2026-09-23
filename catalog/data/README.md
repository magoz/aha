# Data components

Tables and structured values that read without scripts.

- `data-table` — typed columns with sorting, a highlighted row, and
  collapse for long tables. Columns take an optional `priority`:
  `low`-priority columns hide inside narrow containers (container query,
  no viewport rules) while dates and numbers never break mid-token and
  the table scrolls inside its wrapper.
- `key-figures` — two to six headline numbers in a hairline grid with
  mono values. Deltas carry a sign plus an up/down arrow (never colour
  alone); `trend` arrays draw inline SVG sparklines.
- `comparison-matrix` — options across the top, criteria down the side.
  Cells are typed (`mark` yes/no/partial, `text`, `value` with unit); one
  option may set `recommended` for the accent column. The criterion
  column sticks inside the scroll wrapper on narrow containers.
