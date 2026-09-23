# Plans and everyday components

Status, calendars, fact sheets, scalable quantities and quotes. Every
component reads fully without scripts and follows the house style.

- `status-list` — `<figure data-aha="status-list">` with tasks carrying
  a `status` of done, doing, blocked or todo, plus an optional owner,
  due date and note, flat or in named `groups`. State shows as a mono
  glyph plus the word (`[x]` done, `[~]` doing, `[!]` blocked,
  `[ ]` todo); doing takes the accent, blocked the warning red. A
  summary line carries the counts.
- `calendar` — `<figure data-aha="calendar">` with a `month` grid, or a
  week strip when `start`/`end` span ten days or less. Events carry one
  `date` or a `start`/`end` range plus an optional `kind` and `note`;
  multi-day events span every covered cell, `today` is marked, and
  details show on hover or focus. Narrow containers swap the month grid
  for an agenda list (container query, no viewport rules).
- `fact-set` — `<figure data-aha="fact-set">` with key-value `items`,
  flat or in named `groups`. Units render in muted mono after the
  value; wide containers get two fact columns (container query).
- `scalable-list` — `<figure data-aha="scalable-list">` with quantities
  for a base `serves` yield and optional `presets`. A small control
  (−/+ buttons and presets) rescales every numeric quantity live with
  per-unit rounding (grams to fives, spoons to quarters, eggs stay whole
  with a minimum of 1); `qty: null` means to taste and never scales.
  Without scripts the base yield reads directly.
- `quote` — `<figure data-aha="quote">` over the quoted prose plus one
  `<p data-by="Name">` credit paragraph with optional `data-role`,
  `data-source`, `data-source-href` (https only) and `data-date`. A left
  rule and a muted mono caption; no quotation-mark graphics.
