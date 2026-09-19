# Vendored lint provenance

## anti-slop (generic + Effect rules)

- Upstream: https://github.com/dmmulroy/anti-slop
- Revision: `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (public upstream commit)
- Vendored path: `tools/oxlint/anti-slop/` (copied `src/` verbatim: `index.ts`, `effect/`, `rules/`, `shared/`, `vendor/`)
- License: MIT, copyright Dillon Mulroy — retained at `tools/oxlint/anti-slop.LICENSE` and upstream `src/vendor/eslint-stylistic/LICENSE` + `UPSTREAM.md`
- No private source imported. Local policy lives separately in `tools/oxlint/plans-policy/` and is not upstream code.
- Update procedure: fetch the named upstream revision, stage incoming source separately, three-way merge preserving local customizations, re-run `pnpm lint` + `pnpm lint:fixtures`, record the new revision here.

## Local policy

- `tools/oxlint/plans-policy/index.ts` implements `plans-policy/*` rules:
  `no-any`, `no-non-null-assertion`, `no-unsafe-assertion` (except `as const`),
  `no-sync-schema-codec`, `no-disable-validation`, `no-broad-catch-cause`.
- Fixtures: `tools/oxlint/fixtures/` with `verify-fixtures.mjs` harness (`pnpm lint:fixtures`).
