# Text components

Prose wrappers matching the house style. No client code.

- `callout` — note, decision, warning and tip callouts.
- `definition-list` — a `dl` whose every `dt` gains a stable anchor
  (`#` link). Terms keep an author `id` or get one slugified from their
  text; duplicates are suffixed. Rebuilds strip the generated anchors.
- `code-diff` — unified diff JSON (`file`, `diff`) rendered with a file
  header, old/new line numbers from the hunk headers, and a `+`/`-`
  marker column so the diff reads without colour. Long lines scroll
  inside the wrapper, never off the page.
