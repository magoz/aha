/**
 * File-tree styles. Indented folders under a hairline guide, one flex
 * row per file: a glyph-plus-word status column, the path, and the
 * note in the muted column. Notes wrap under the path on narrow
 * containers (container query, no viewport rules).
 */

export const FILE_TREE_CSS = `
.aha-ftree { max-width: 100%; container-type: inline-size; }
.aha-ftree .aha-title { font-family: var(--mono); font-size: var(--t-sm); margin: 0 0 0.5rem; }
.aha-ftree ul.tree, .aha-ftree ul.tree ul { list-style: none; margin: 0; padding: 0; }
.aha-ftree ul.tree ul { margin-left: 0.375rem; padding-left: 0.875rem; border-left: 1px solid var(--hair); }
.aha-ftree .dir { margin: 0; }
.aha-ftree .dirname { display: flex; gap: 0.5rem; align-items: baseline; width: 100%; padding: 0.375rem 0; border: 0; background: none; color: var(--ink); font-family: var(--mono); font-size: var(--t-sm); text-align: left; cursor: pointer; }
.aha-ftree .dirname .twisty { color: var(--muted); width: 1rem; }
.aha-ftree .dirname .nm { font-weight: 600; overflow-wrap: anywhere; }
.aha-ftree .dirname .count { color: var(--muted); font-size: var(--t-xs); }
.aha-ftree .file { display: flex; flex-wrap: wrap; gap: 0 0.5rem; align-items: baseline; margin: 0; padding: 0.375rem 0 0.375rem 1.5rem; font-family: var(--mono); font-size: var(--t-sm); }
.aha-ftree .st { width: 1rem; min-width: 1rem; text-align: center; color: var(--muted); user-select: none; }
.aha-ftree .st-added { color: var(--accent); font-weight: 600; }
.aha-ftree .st-changed { color: var(--ink); }
.aha-ftree .st-removed { color: var(--muted); }
.aha-ftree .st-renamed { color: var(--ink); }
.aha-ftree .file .nm { overflow-wrap: anywhere; }
.aha-ftree .file .nm.struck { text-decoration: line-through; color: var(--muted); }
.aha-ftree .file .was { color: var(--muted); overflow-wrap: anywhere; }
.aha-ftree .file .was-arrow { color: var(--muted); }
.aha-ftree .file .note { flex: 1 1 100%; margin-left: 1.5rem; color: var(--muted); font-size: var(--t-sm); }
.aha-ftree .vh { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.aha-ftree li { position: relative; }
@container (min-width: 40rem) {
  .aha-ftree .file { flex-wrap: nowrap; }
  .aha-ftree .file .nm, .aha-ftree .file .was { flex: 0 1 auto; }
  .aha-ftree .file .note { flex: 1 1 auto; margin-left: auto; padding-left: 1.5rem; }
}
@media print {
  .aha-ftree ul[hidden] { display: block; }
}
`
