# Aha publishing skill

Publish a self-contained static HTML file with the `aha` CLI. The product is
"Aha"; each document is "an aha": one self-contained page an agent hands you
to explain something — explainers, visual concept walkthroughs, comparisons,
plans. Documents are private by default; publish only on explicit owner
instruction.

## Workflow

1. Write one self-contained `.html` file: inline `<style>` only, no
   `<script>`, no forms, no frames, no external resources. Keep it under 2 MiB.
   Start from `templates/note.html` (short) or `templates/plan.html` (long) in
   this repository and follow the
   [document style](#document-style) below.
2. Upload privately and capture the URL:

   ```sh
   aha upload ./page.html
   # prints {"id":"<id>","url":"https://aha.oox.sh/<id>","etag":"..."}
   ```

   The share URL is `https://aha.oox.sh/<id>`. Anonymous off-tailnet reads
   return 404 until published. Private tailnet reads require the configured
   gateway and split DNS; an upload does not configure that infrastructure.

3. Share the URL. The owner publishes explicitly:

   ```sh
   aha publish <id>
   aha unpublish <id>
   ```

## Document style

Two reference documents carry the house style; copy the `<style>` block of the
matching one verbatim and reuse its markup patterns. Change content, not the
stylesheet (append a few lines only for a component the reference lacks, in
the same idiom).

- `templates/note.html` — a short note (most ahas): explainer, concept
  walkthrough, comparison, decision. Kicker line, `h1`, content. No metadata
  block, no contents list.
- `templates/plan.html` — a long document (roughly six or more sections, or a
  plan/RFC): metadata block with only the fields that apply, contents list,
  numbered sections.

The style is "mono technical": a beautifully typeset README, not a landing
page and not an academic paper.

**Typography.** Monospace (`ui-monospace, "SF Mono", Menlo, Consolas`) for the
`h1`, section headers, labels, metadata, tables, code, contents, and captions.
System sans (`system-ui`) for body paragraphs at 16 px, line-height 1.5, prose
capped at 40 rem inside a 44 rem page. Five sizes only: 28 / 20 / 16 / 13 /
11 px. Section headers read `01 — TITLE` in small mono caps above a hairline,
with an optional right-aligned mono aside (`5 weeks`, `3 open`). Spacing on a
24 px unit. No serif anywhere, no web fonts.

**Color.** Light: paper `#faf8f4`, ink `#1b1a18`, muted `#6b6862`, rule
`#d8d4cc`, hairline `#e8e5de`. Dark (`prefers-color-scheme`): paper `#1d1d1c`,
ink `#e4e2dd`, muted `#9a9790`, rule `#3c3b38`, hairline `#2d2c2a`. Accent
moss `#3f6b4a` / `#8fbf98` only for meaning: recommended, decision, open items,
`+` diff lines, footnote marks, the one highlighted box in a diagram. Warning
red `#b3261e` / `#e0705f` only for warnings. Print collapses to black on white.

**Components.** Hairline 1 px boxes and rules, sharp corners (no radius).
Callouts (`note`, `decision`, `warning`) are a left rule plus a small mono
label, no fill. Badges are thin bordered mono pills. Tables have a mono header
row and scroll horizontally inside a wrapper on narrow screens. Key numbers are
a real table, not stat cards. Phases and steps use the timeline pattern (mono
markers on a hairline spine). Task lists use `[x]`/`[ ]` mono checkboxes.
Diagrams are inline SVG: square 1 px `currentColor` boxes, polygon arrowheads,
a label on every box, `<figure>` with a numbered mono caption. Code sits in
`<pre>` with a hairline border and no syntax colors; show changes as a diff.
Footnotes are real footnotes with return links. Glossaries use `<dl>`.

**Writing.** Specific numbers over adjectives, short sentences, no
exclamation marks, no marketing tone, no "in this note we will". State a
decision and its trade-off in one callout. Every phase has a duration and exit
criteria; every risk has a mitigation; every open question has an owner. Be
correct: a senior engineer reads these.

**Never.** Gradients, shadows, glassmorphism, tinted cards, rounded corners,
purple/indigo palettes, emoji, icons, centered hero sections, fake progress
bars, stock illustrations, neon or glow "terminal" effects, margin notes, a
second accent color, a serif.

## Rules

- Never publish or unpublish without an explicit owner instruction.
- Keep secrets and credentials out of uploaded pages. Never commit real ahas or
  private documents to the source repository.
- Updates replace content in place and preserve visibility:

  ```sh
  aha update <id> ./page.html [--if-match <etag>]
  ```

- Read back with `aha read <id> [--output out.html]`; list with
  `aha list [--public] [--json]`.
- Configure via `--endpoint`/`AHA_ENDPOINT` (default
  `https://aha.oox.sh`; loopback `http:` only for development) and
  `--token`/`AHA_OWNER_TOKEN`. On split-DNS tailnets, set the endpoint
  to the public deployment alias (the gateway at the default URL rejects
  `/api/*`); share links still use `AHA_PUBLIC_URL`
  (default `https://aha.oox.sh`).
