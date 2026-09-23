# Research components

Sources, claims, decisions, trade-offs and risks.

- `sources` — a numbered reference list with the URL visible in mono.
  Entries take an optional `id` gaining a stable `src-<id>` anchor, so
  prose cites them as `<a href="#src-<id>">[n]</a>` and `claims` links
  to them. Numbers follow list order.
- `claims` — findings with a `statement`, a `high`/`medium`/`low`
  confidence badge (text plus glyph, never colour alone), and optional
  `sources` ids rendering as `[n]` links to the `sources` anchors.
  Numbers follow first-mention order across the block: keep the
  `sources` list in the same order so the numbers match. A malformed
  or duplicated id fails the build at its exact path.
- `decision-record` — one ADR per block: `title`, `status`
  (`proposed`/`accepted`/`superseded`), `date`, `context`, `options`
  with one-line summaries, the `decision` naming one `options[].name`
  plus why, and `consequences` positive/negative lists. The chosen
  option renders with the accent edge plus a `chosen` marker; a
  decision naming no listed option fails the build.
- `pros-cons` — two columns (stacking inside narrow containers) with
  an optional per-item `weight` mono marker (a few characters, never a
  bar) and an optional `verdict` line.
- `risk-matrix` — risks with `likelihood` and `impact` (1 to 5, or
  low/med/high) plotted as numbered markers on a small grid, plus a
  list with each risk's `mitigation` and `owner`. Hovering or focusing
  a marker highlights its row and vice versa through one small client
  script; the grid and list read fully without scripts.
- `faq` — a markup component: children are
  `<details><summary>Q</summary>…answer markup…</details>`. Native
  disclosures work without scripts; with scripts a single Expand all /
  Collapse all control appears on top.
