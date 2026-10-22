# Aha

Personal HTML publishing for agents. Private by default; publish and unpublish with R2 marker objects.

Production hostname: `https://aha.o-o.co` (a Cloudflare Worker). `https://aha.oox.sh/*` permanently redirects there.

## Setup

Requires Node 24 and pnpm 10.

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs format check, typecheck, lint, tests and build.

## Architecture

- Plain TypeScript + Effect 4. No Next.js or React.
- One Cloudflare Worker (`server/worker.ts`) serves all HTTP and reads a private R2 bucket through its binding. Documents stream end to end, so no page sits in memory. Alchemy (`infra/`) provisions the bucket and the Worker.
- The private R2 bucket stores:
  - `aha/<id>.html`: the current HTML document.
  - `public/<id>`: an empty marker; present means public, missing means private.
  - `session/<sha256>` and `pairing/<sha256>`: paired browsers and one-time pairing codes, stored only as hashes.
- Every anonymous `GET`/`HEAD` checks the marker first. Storage failures fail closed (deny, never treat as missing or public). HTML and access decisions are never cached.
- Readable IDs: the owner picks a name at upload (`POST /api/documents?name=<name>`, lowercase letters, digits and single dashes, up to 80 characters, `api` reserved). Uploads never overwrite: a taken name returns 409 (enforced by a conditional `If-None-Match: *` write). Older random 22-character IDs keep working. Updates replace content in place and preserve visibility. No version history in v1.
- `lib/` holds the Effect core (`AhaStorage` and `SessionStore` Context services, domain Effects, HTTP boundary, R2 binding storage). Runtime adapters run Effects only at entrypoints (`server/worker.ts`, `cli/`). Tests use typed in-memory fakes (`tests/fake-storage.ts`, `tests/fake-r2-bucket.ts`); no module mocks.

## CLI

```sh
pnpm aha upload ./page.html [--name <name>]   # name defaults to the page <title>
pnpm aha update <id> ./page.html [--if-match <etag>]
pnpm aha publish <id>
pnpm aha unpublish <id>
pnpm aha list [--public] [--json]
pnpm aha read <id> [--output out.html]
pnpm aha delete <id>   # only when unpublished, otherwise 409
pnpm aha pair          # one-time link + QR code to let a browser open private pages
pnpm aha devices [--json]
pnpm aha unpair <id-prefix> | --all
```

`pnpm build` produces `dist/cli/aha.js`; it does not install a global command.
For the dotfiles-managed setup, keep this checkout at `~/aha` and stow the
`scripts` and `agents` packages from `~/.dotfiles/home`. The launcher at
`~/.local/bin/aha` invokes the built CLI without changing your working directory:

```sh
aha upload ./page.html
```

The shared agent skill points to this repository's `SKILL.md`. Dotfiles owns only
the launcher and skill entry, not a copy of the application. There is no npm
publication or global npm install. After updating the checkout, run
`pnpm install --frozen-lockfile && pnpm build` to refresh the CLI.

Configuration:

- `--endpoint <url>` or `AHA_ENDPOINT` (default `https://aha.o-o.co`). Only `https:` endpoints are allowed, except loopback `http:` (`127.0.0.1`, `::1`, `localhost`) for development (e.g. `https://aha-dev.o-o.co` or a local `pnpm dev`).
- `--public-url <url>` or `AHA_PUBLIC_URL` (default `https://aha.o-o.co`). Canonical base for share URLs printed by `upload`/`publish`, independent of `--endpoint`.
- `--token <token>` or `AHA_OWNER_TOKEN`. Tokens may also live in `~/.config/aha/credentials` (`0600`) or `$AHA_CREDENTIALS_FILE`; the CLI never logs tokens.
- `read` uses the owner token against `/api/documents/<id>`; public reads use `https://aha.o-o.co/<id>` without credentials.

Uploads are bounded to 95 MiB (`MAX_HTML_BYTES`; Workers accept 100 MB request bodies on Free and Pro zones). The CLI refuses larger files before sending; the Worker requires `Content-Length` (411 without it), rejects larger declarations (413) and streams the body into R2 through a fixed-length stream, so a body that differs from its declared size is never stored. Non-`text/html` content types are rejected. Updates never create unknown IDs and never change markers. Updates accept an optional `If-Match` ETag; mismatches return 412. Without `If-Match`, latest-write wins (documented here).

## Preview

Check a page locally under the exact production CSP before uploading:

```sh
pnpm preview ./page.html
pnpm preview ./page.html --out ./shots
pnpm preview ./page.html --serve
pnpm preview ./page.html --serve --port 4123
```

The default run serves the file on loopback with the production security headers, captures desktop (1280x800) and mobile (390x844) screenshots with headless Chromium, and prints one JSON summary (`url`, screenshot paths, `tiles` for pages taller than one 2000px section, `problems`, `elapsedMs`). It exits 1 when problems are found: uncaught exceptions, console errors/warnings, log entries at error/warning level (CSP violations are tagged `csp`), or mobile horizontal overflow. Each viewport is also captured in dark mode (`prefers-color-scheme`), reported as `screenshots.desktopDark`/`mobileDark` and `tiles.desktopDark`/`mobileDark`, and hover/focus overlays are probed for clipping (`clip`) while chart SVGs are checked for overlap with following content (`overlap`). Look at the light and dark tiles before uploading. `--serve` only prints the URL and keeps serving until Ctrl-C. Chromium is resolved from `AHA_CHROMIUM` or the usual `chromium`, `chromium-browser`, `google-chrome`, `google-chrome-stable` names on `PATH`.

## Security and public marker contract

- All documents are private by default. Publication requires an explicit `publish` (creates empty `public/<id>`). `unpublish` deletes the marker. `update` preserves visibility.
- The owner bearer token permits mutations, listing, publishing and pairing. A paired browser (cookie from `aha pair`) may only `GET`/`HEAD` pages at `/<id>`, public or private. Public anonymous reads require a present marker.
- Pairing: `aha pair` creates a one-time code valid for 10 minutes. `GET /pair/<code>` only shows a button (link previews cannot use it up); the `POST` uses up the code and sets `__Host-aha-session` (`Secure`, `HttpOnly`, `SameSite=Lax`, host-only, renewed on every view by that browser up to the 400-day browser cap; no server-side expiry). The Worker has no `workers.dev` or preview URLs. R2 stores only the SHA-256 of codes and session tokens. `aha devices` lists paired browsers and `aha unpair` revokes one or all.
- Marker and session check errors fail closed with 502, never 404 and never content.
- Never trust `Host`, `X-Forwarded-*`, client IPs or DNS for access. Private access is decided only by the owner bearer or a paired-browser session that exists in storage, or by the marker for anonymous reads.
- Invalid IDs and path traversal never become storage keys; only `[A-Za-z0-9_-]{1,80}` IDs are accepted.
- No raw object routes. `/` and `/api/health` disclose no IDs. No secrets in logs or errors.
- Every document and status response carries `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and a restrictive CSP: opaque-origin `sandbox allow-scripts`, inline scripts and styles allowed, inline event-handler attributes blocked, no forms, frames, network or external resources, `data:` images/fonts only (`default-src 'none'; script-src 'unsafe-inline'; script-src-attr 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; sandbox allow-scripts`).
- `HEAD`, `Range`, and conditional requests (`If-None-Match`, `If-Modified-Since`, `Range`) cannot bypass access: markers are checked before any content handling, ranges are ignored (full bounded body or `416` is never used to leak existence beyond the access decision).

## Deployment

The Worker's settings come from Alchemy (`infra/alchemy.run.ts`): the R2 bucket binding `AHA_BUCKET`, the secret `AHA_OWNER_TOKEN` (read from the deploying shell) and `AHA_PUBLIC_URL`. There are no R2 API keys. Stages are separate: `prod` (`aha-prod` bucket, `aha.o-o.co`) and anything else (`aha-dev`, `aha-dev.o-o.co`).

```sh
cd infra
pnpm install --frozen-lockfile
AHA_OWNER_TOKEN=... pnpm exec alchemy plan --stage dev --profile <profile>
AHA_OWNER_TOKEN=... pnpm exec alchemy deploy --stage dev --profile <profile>  # operator-authorized only
```

`pnpm dev` runs the dev stage locally with `alchemy dev`. No destructive default command; `forceDestroy` stays `false` and buckets are retained. See `infra/README.md` and `docs/deployment.md`.

The root `vercel.json` is only the permanent redirect from the old `aha.oox.sh` deployment. Never commit real values, Alchemy state (`.alchemy/`), Vercel metadata (`.vercel/`), or real ahas.

## Agent skill

`SKILL.md` contains a short agent skill: write a self-contained static HTML file, upload privately with the CLI, share the `https://aha.o-o.co/<id>` URL, publish only on explicit owner instruction. `templates/note.html` (short note) and `templates/plan.html` (long document) are the reference documents for the house style: copy the stylesheet, change the content. `fixtures/sample.html` is synthetic, non-sensitive sample content.

## Validation

`pnpm verify` runs format check, typecheck, lint, tests and build. Tests cover absent/present/deleted markers, owner/paired-browser/public separation, pairing (one-time, expiry, hashes only, revocation, cookie flags), storage-unavailable denial, `HEAD`/range/conditional handling, path traversal and invalid IDs, create-only name collisions through the R2 binding, upload limits including missing, oversized and lying `Content-Length`, invalid/missing config, update visibility preservation, CLI parsing, pairing commands and uploads against the real Worker handler, and a full Worker lifecycle against a fake R2 binding. CI runs frozen install, `pnpm verify` and isolated infrastructure checks, all without deployment credentials.
