# Diagrams

Automatically laid out SVG diagrams. The author gives structure (nodes and
edges, actors and messages, a nested hierarchy, phases and dates, states
and transitions) and never places coordinates.

- `flow-diagram` — directed graph with optional groups and one highlighted
  path. Left-to-right above 560px, top-to-bottom below.
- `sequence-diagram` — actors as lifelines with ordered sync, async and
  return messages plus notes. Lanes stretch to the container; a horizontal
  scroll wrapper is the fallback when actors cannot fit.
- `tree-diagram` — hierarchy with collapsible nodes (fully expanded
  without scripts). Tidy tree above 560px, indented list below.
- `timeline` — phases and milestones on a date axis with an optional
  today marker. Static SVG with a resize-only client, no interaction.
- `state-diagram` — states and labelled transitions with an initial
  state and final states, on the flow layout engine.

Shared code lives in this directory, not in `catalog/shared/`:

- `layout.ts` — deterministic DAG layering (longest path plus two
  barycentric sweeps), box metrics, orthogonal back-edge lanes, group
  bounds and the SVG box/edge builders. Render files import it alongside
  `catalog/shared/`; it stays free of Effect, Schema and DOM so client
  bundles keep the no-`effect` guarantee.
- `diagram-css.ts` — the shared diagram kit (boxes, edges, selection).
- `diagram-client.ts` — hover/focus/tap/keyboard selection for
  node-link diagrams.
