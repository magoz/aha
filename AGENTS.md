# Aha

Personal HTML publishing for agents. Public repository: never commit credentials, private documents, machine-specific configuration, or infrastructure state.

## Architecture

- TypeScript + Effect, no Next.js or React. One Cloudflare Worker (`server/worker.ts`, `aha.o-o.co`) handles all HTTP and reads a private R2 bucket through its binding; documents stream end to end. The root `vercel.json` only redirects the legacy `aha.oox.sh`.
- `aha/<id>.html` stores the current HTML. Empty `public/<id>` object means public. Missing marker means private. `session/<hash>` and `pairing/<hash>` hold paired browsers and one-time codes, as SHA-256 hashes only. The bucket and all direct access domains (`r2.dev`, custom domains) stay private/disabled.
- IDs are owner-chosen readable names (legacy random IDs stay valid), so URLs are guessable; privacy comes only from the marker. Creates are conditional writes and never overwrite an existing name.
- Every anonymous GET and HEAD checks publication. Storage failures fail closed. No caching of HTML or access decisions. Updates preserve publication state.
- The owner bearer credential permits mutations, listing, publishing and pairing. A paired browser (`aha pair` one-time link, then a `__Host-` session cookie) may only read pages at `/<id>`. Never infer private access from client IP, Host, forwarded headers, or DNS.
- One limit, `MAX_HTML_BYTES` (95 MiB, under the Workers 100 MB request cap), bounds CLI, Worker and preview. Uploads must declare `Content-Length`; storage enforces it with a fixed-length stream.
- Alchemy provisions Cloudflare resources. Retain storage on teardown. Separate production and development resources. No infrastructure changes without operator authorization.

## Conventions

- Effect 4. Boundary inputs are decoded with Effect Schema. Shared errors use Schema.TaggedError. Domain code returns Effects; runtimes run them only at entrypoints.
- Dependencies use Context services and Layers. Tests use typed fake services, not module mocks. Pure transformations stay ordinary functions.
- Strict TypeScript including noUncheckedIndexedAccess and exactOptionalPropertyTypes. No any, non-null assertions, unchecked casts, sync throwing Schema codecs, or broad catchCause wrappers.
- Oxlint and Oxfmt; no semicolons, single quotes, no trailing commas, 100-column width. Applicable anti-slop rules are errors, not warnings. Do not relax rules to make checks pass.
- Named exports except runtime/config-required defaults. Kebab-case filenames. No barrel files. Domain types live with their owner.
- Root-level lib/, server/, cli/, infra/, tests/ as appropriate; no unnecessary monorepo scaffolding. Core code types the R2 binding locally (`lib/storage-r2.ts`) instead of importing Workers globals.
- Pin compatible Effect-family versions. Infrastructure may be a separate package if Alchemy's Effect version requires it.

## Security

- Self-contained single-file HTML. Serve with restrictive CSP (`sandbox allow-scripts` with an opaque origin; inline scripts allowed, inline event-handler attributes blocked; no network/external resources/forms/frames), no-referrer, nosniff and no-store. The owner is the only author, so inline scripts are an accepted risk. Do not expose service credentials through HTML, URLs, logs or errors.
- Owner-only writes; all documents private by default. Publication requires explicit CLI command. Invalid IDs/path traversal must never become arbitrary storage keys.
- A paired-browser cookie cannot mutate, list, publish or pair, and grants nothing on `/api/*`. Store only hashes of pairing codes and session tokens; pairing links show a button and pair on POST so link previews cannot use them.
- Uploaded sample documents must be synthetic, non-sensitive data.
- Prefer bounded reads/uploads and conservative defaults over exposing object-storage primitives.

## Catalog and preview

- `catalog/` holds the component catalog behind `aha build` and `aha components`; `docs/catalog.md` is the contributor guide (adding components and categories, parallel work, review checklist).
- `pnpm preview <file>` (`tools/preview*.ts`) serves a page under the production CSP and reports script errors, CSP violations, mobile overflow, clipped hover overlays and chart overlaps, with light and dark screenshots. A catalog or page change is not done until preview is clean and its tiles have been read.

## Validation

Provide `pnpm verify`: format check, typecheck, lint, tests and build. Test absent/present/deleted markers, storage failures, forged credentials and cookies, owner/paired-browser/public separation, pairing (one-time, expiry, revocation, cookie flags), unsafe IDs, name collisions and leftover markers on create, upload limits including missing and mismatched `Content-Length`, update visibility preservation, and the Worker against a fake R2 binding.

## Git

Use the configured Git identity. No identity overrides. Never stage env files, Alchemy state, Vercel metadata, generated artifacts or real ahas.
