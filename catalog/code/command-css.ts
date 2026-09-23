/**
 * Command styles. A hairline prompt line with an unselectable glyph,
 * a scrolling output block with stdout and stderr lanes, and an exit
 * badge. Stderr and nonzero exits pair the warning colour with a
 * marker glyph and words, never colour alone.
 */

export const COMMAND_CSS = `
.aha-cmd { max-width: 100%; border: 1px solid var(--rule); margin: 0 0 var(--unit); }
.aha-cmd .cmdline { display: flex; flex-wrap: nowrap; gap: 0.25rem 0.5rem; align-items: baseline; padding: 0.75rem 1rem; font-family: var(--mono); font-size: var(--t-sm); overflow-x: auto; }
.aha-cmd .prompt { color: var(--accent); font-weight: 600; user-select: none; flex: 0 0 auto; }
.aha-cmd .cwd { color: var(--muted); flex: 0 0 auto; }
.aha-cmd .cmd { font-size: inherit; white-space: pre; flex: 0 0 auto; }
.aha-cmd .copy { font-family: var(--mono); font-size: var(--t-xs); padding: 0.25rem 0.5rem; border: 1px solid var(--rule); background: none; color: var(--muted); cursor: pointer; flex: 0 0 auto; }
.aha-cmd .copy:hover { border-color: var(--accent); color: var(--accent); }
.aha-cmd .exit { font-size: var(--t-xs); white-space: nowrap; flex: 0 0 auto; }
.aha-cmd .exit.ok { color: var(--muted); }
.aha-cmd .exit.bad { color: var(--warn); font-weight: 600; }
.aha-cmd .out { border-top: 1px solid var(--hair); padding: 0.75rem 1rem; font-family: var(--mono); font-size: var(--t-sm); line-height: 1.6; max-height: 20rem; overflow: auto; }
.aha-cmd .out p { margin: 0; display: flex; gap: 0.5rem; align-items: baseline; }
.aha-cmd .out .mk { color: var(--muted); user-select: none; }
.aha-cmd .out .tx { white-space: pre; }
.aha-cmd .out .e .mk { color: var(--warn); font-weight: 600; }
.aha-cmd .out .e .tx { color: var(--warn); }
.aha-cmd .vh { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.aha-cmd .cmdline, .aha-cmd .out { position: relative; }
@media print {
  .aha-cmd .copy { display: none; }
  .aha-cmd .out { max-height: none; overflow: visible; }
}
`
