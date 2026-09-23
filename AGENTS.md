# Aha

Personal HTML publishing for agents. Public repository: never commit credentials, private documents, machine-specific configuration, or infrastructure state.

## Architecture

- TypeScript + Effect, no Next.js or React. Vercel handles public HTTP; private Cloudflare R2 stores documents and publication markers.
- `aha/<id>.html` stores the current HTML. Empty `public/<id>` object means public. Missing marker means private. The bucket and all direct access domains stay private/disabled.
- Every anonymous GET and HEAD checks publication. Storage failures fail closed. No caching of HTML or access decisions. Updates preserve publication state.
- Administrative bearer credential permits mutations and listing. Separate private-read credential permits document reads only, for a tailnet-only gateway. Never infer private access from client IP, Host, forwarded headers, or DNS alone.
- Same hostname via split DNS is an operational setup: private gateway on the tailnet; Vercel on public DNS. The gateway must be constrained to a fixed HTTPS upstream and safe document-read paths.
- Alchemy provisions Cloudflare resources. Retain storage on teardown. Separate production and development resources. No infrastructure changes without operator authorization.

## Conventions

- Effect 4. Boundary inputs are decoded with Effect Schema. Shared errors use Schema.TaggedError. Domain code returns Effects; runtimes run them only at entrypoints.
- Dependencies use Context services and Layers. Tests use typed fake services, not module mocks. Pure transformations stay ordinary functions.
- Strict TypeScript including noUncheckedIndexedAccess and exactOptionalPropertyTypes. No any, non-null assertions, unchecked casts, sync throwing Schema codecs, or broad catchCause wrappers.
- Oxlint and Oxfmt; no semicolons, single quotes, no trailing commas, 100-column width. Applicable anti-slop rules are errors, not warnings. Do not relax rules to make checks pass.
- Named exports except runtime/config-required defaults. Kebab-case filenames. No barrel files. Domain types live with their owner.
- Root-level lib/, api/, cli/, infra/, tests/ as appropriate; no unnecessary monorepo scaffolding.
- Pin compatible Effect-family versions. Infrastructure may be a separate package if Alchemy's Effect version requires it.

## Security

- Self-contained single-file HTML. Serve with restrictive CSP (`sandbox allow-scripts` with an opaque origin; inline scripts allowed, inline event-handler attributes blocked; no network/external resources/forms/frames), no-referrer, nosniff and no-store. The owner is the only author, so inline scripts are an accepted risk. Do not expose service credentials through HTML, URLs, logs or errors.
- Owner-only writes; all documents private by default. Publication requires explicit CLI command. Invalid IDs/path traversal must never become arbitrary storage keys.
- A private read credential cannot mutate, list, or publish. Gateway must strip client credentials and never follow redirects that could leak its credential.
- Uploaded sample documents must be synthetic, non-sensitive data.
- Prefer bounded reads/uploads and conservative defaults over exposing object-storage primitives.

## Catalog and preview

- `catalog/` holds the component catalog behind `aha build` and `aha components`; `docs/catalog.md` is the contributor guide (adding components and categories, parallel work, review checklist).
- `pnpm preview <file>` (`tools/preview*.ts`) serves a page under the production CSP and reports script errors, CSP violations, mobile overflow, clipped hover overlays and chart overlaps, with light and dark screenshots. A catalog or page change is not done until preview is clean and its tiles have been read.

## Validation

Provide `pnpm verify`: format check, typecheck, lint, tests and build. Test absent/present/deleted markers, storage failures, forged private headers, credential separation, unsafe IDs, upload limits, update visibility preservation, and the constrained private gateway.

## Git

Use the configured Git identity. No identity overrides. Never stage env files, Alchemy state, Vercel metadata, generated artifacts or real ahas.
