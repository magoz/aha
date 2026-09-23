# Code components

Annotated code, file trees, schemas, commands and before/after views.
Every component reads fully without scripts; the three interactive ones
(annotated-code, file-tree, command) enhance in place with small clients.

- `annotated-code` — a code block with a language label and optional
  filename, where numbered markers (`[1]`) link lines to notes rendered
  below the code, or beside it on wide containers (container query, no
  viewport rules). Hovering or focusing a note highlights its lines and
  vice versa. No syntax highlighting library; ink, muted and accent only.
- `file-tree` — a flat path list grouped into folders in display order,
  with a glyph-plus-word status column (`+` added, `~` changed, `-`
  removed with struck name, `→` renamed with the old name) and notes in
  a muted column that wraps under the path on narrow containers. Folders
  render expanded and collapse when scripts run. `previous` is only valid
  with status `renamed`.
- `schema-table` — field lists for APIs, configs and tables. Nested
  objects and arrays nest through `fields` and render under dotted paths
  (`limits.maxBytes`) with depth indentation. `required` reads as a word;
  `default` and `example` are wire-formatted strings. The example column
  appears only when at least one field carries an example.
- `command` — a shell command with an optional working directory, capped
  scrolling output with stdout (`›`) and stderr (`!`, warning lane)
  markers, and an exit badge (nonzero takes the warning lane). The `$`
  prompt glyph is unselectable; the copy button degrades silently when
  clipboard access is denied.
- `side-by-side` — two labelled panes holding text or code, side by side
  on wide containers and stacked on narrow ones. Code panes take a
  `language` for line numbers and may mark `changedLines`. Authors supply
  both sides; there is no diffing.
