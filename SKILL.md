# Aha publishing skill

Publish a self-contained static HTML file with the `aha` CLI. The product is
"Aha"; each document is "an aha": one self-contained page an agent hands you
to explain something — explainers, visual concept walkthroughs, comparisons,
plans. Documents are private by default; publish only on explicit owner
instruction.

## Workflow

1. Write one self-contained `.html` file: inline `<style>` only, no
   `<script>`, no forms, no frames, no external resources. Keep it under 2 MiB.
   Start from `templates/plan.html` in this repository and follow the
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

`templates/plan.html` is the reference document: a complete, fictional
engineering plan showing every component in the house style. Copy its
`<style>` block verbatim and reuse its markup patterns; change content, not the
stylesheet. The goal is a page that looks typeset by a careful person, not a
landing page.

**Structure.** Kicker line (document id · owner · status badge), one `h1`,
metadata `<dl>` (status, date, target, owner, reviewers), contents list, then
numbered sections. Typical order for an aha: summary, problem, goals and
non-goals, architecture, options and decision, key numbers, phases, work items,
implementation notes, risks, open questions, rollback, glossary, references.
Drop sections that do not apply; never add filler ones ("Introduction",
"Conclusion").

**Typography.** Warm paper (`#f6f1e8`) and warm ink (`#2a2420`), never pure
black on white. System serif for headings, blockquotes and the decision;
humanist system sans for body at 17–18 px on a ~38 rem measure; `ui-monospace`
for identifiers, numbers in tables and code. Five type sizes only. Vertical
rhythm from one spacing unit. No web fonts.

**Color.** One accent, moss green (`--accent: #3f6b4a`, dark `#8fbf98`), used
only for meaning: the recommended option, the decision, open items, footnote
markers, the highlighted box in a diagram. Warnings use a separate red
(`--warn: #b3261e`, dark `#e0705f`). Everything else is ink, muted ink and
hairlines. Dark mode is a tuned palette, not an inversion; print collapses to
black on white.

**Components.** Callouts (`note`, `decision`, `warning`) are left-ruled
paragraphs with a small uppercase label, no fill. Badges are thin bordered
pills (Draft, Recommended, Done, Open, Blocked). Tables have hairline rows and
scroll horizontally inside a wrapper on narrow screens. Diagrams are inline
SVG with 1 px `currentColor` boxes, polygon arrowheads, and a label on every
box; use `<figure>` with a numbered caption. Code sits in `<pre>` with a faint
background and no syntax colors; show changes as a diff. Footnotes are real
footnotes with return links. Glossaries use `<dl>`.

**Writing.** Specific numbers over adjectives, short sentences, no
exclamation marks, no marketing tone. State the decision and its trade-off in
one callout. Every phase has a duration and exit criteria; every risk has a
mitigation; every open question has an owner.

**Never.** Gradients, shadows, glassmorphism, tinted cards everywhere,
purple/indigo palettes, emoji, decorative icons, centered hero sections,
rounded-everything, fake progress bars, stock illustrations, margin notes, a
second accent color.

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
