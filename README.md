# Aha

Personal HTML publishing for agents. Private by default; publish and unpublish with R2 marker objects.

Production hostname: `https://aha.oox.sh`.

## Setup

Requires Node 24 and pnpm 10.

```sh
pnpm install --frozen-lockfile
cp .env.example .env  # fill in values, never commit .env
pnpm verify
```

`pnpm verify` runs format check, typecheck, lint, tests and build.

## Architecture

- Plain TypeScript + Effect 4. No Next.js or React.
- Vercel serves public HTTP from `api/`. A small Node server (`server/`) supports local development and smoke tests. A separate loopback-only private gateway (`gateway/`) exposes tailnet-local reads.
- Private Cloudflare R2 bucket stores documents and publication markers:
  - `aha/<id>.html` holds the current HTML document.
  - Empty `public/<id>` object means public. Missing marker means private.
- Every anonymous `GET`/`HEAD` checks the marker first. Storage failures fail closed (deny, never treat as missing or public). HTML and access decisions are never cached.
- Stable IDs: cryptographically random 128-bit values encoded as 22-character base64url (`[A-Za-z0-9_-]{22}`). Updates replace content in place and preserve visibility. No version history in v1.
- `lib/` holds the Effect core (`AhaStorage` Context service, domain Effects, HTTP boundary). Runtime adapters run Effects only at entrypoints (`api/`, `server/`, `gateway/`, `cli/`, `infra/`). Tests use a typed in-memory fake (`tests/fake-storage.ts`); no module mocks.

## CLI

```sh
pnpm aha upload ./page.html
pnpm aha update <id> ./page.html [--if-match <etag>]
pnpm aha publish <id>
pnpm aha unpublish <id>
pnpm aha list [--public] [--json]
pnpm aha read <id> [--output out.html]
pnpm aha delete <id>   # only when unpublished, otherwise 409
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

- `--endpoint <url>` or `AHA_ENDPOINT` (default `https://aha.oox.sh`). Only `https:` endpoints are allowed, except loopback `http:` (`127.0.0.1`, `::1`, `localhost`) for development. Under split DNS the same browser URL routes to the read-only private gateway, which rejects `/api/*`; point the CLI at the public deployment alias instead (e.g. `AHA_ENDPOINT=https://<public-alias>`) and never proxy owner writes through the gateway.
- `--public-url <url>` or `AHA_PUBLIC_URL` (default `https://aha.oox.sh`). Canonical base for share URLs printed by `upload`/`publish`, independent of `--endpoint`, so split-DNS operators still hand out `https://aha.oox.sh/<id>` links.
- `--token <token>` or `AHA_OWNER_TOKEN`. Tokens may also live in `~/.config/aha/credentials` (`0600`) or `$AHA_CREDENTIALS_FILE`; the CLI never logs tokens.
- `read` uses the owner token against `/api/documents/<id>`; public reads use `https://aha.oox.sh/<id>` without credentials.

Uploads are bounded to 2 MiB with real byte accounting; non-`text/html` content types are rejected. Updates never create unknown IDs and never change markers. Updates accept an optional `If-Match` ETag; mismatches return 412. Without `If-Match`, latest-write wins (documented here).

## Preview

Check a page locally under the exact production CSP before uploading:

```sh
pnpm preview ./page.html
pnpm preview ./page.html --out ./shots
pnpm preview ./page.html --serve
pnpm preview ./page.html --serve --port 4123
```

The default run serves the file on loopback with the production security headers, captures desktop (1280x800) and mobile (390x844) screenshots with headless Chromium, and prints one JSON summary (`url`, screenshot paths, `problems`, `elapsedMs`). It exits 1 when problems are found: uncaught exceptions, console errors/warnings, log entries at error/warning level (CSP violations are tagged `csp`), or mobile horizontal overflow. `--serve` only prints the URL and keeps serving until Ctrl-C. Chromium is resolved from `AHA_CHROMIUM` or the usual `chromium`, `chromium-browser`, `google-chrome`, `google-chrome-stable` names on `PATH`.

## Security and public marker contract

- All documents are private by default. Publication requires an explicit `publish` (creates empty `public/<id>`). `unpublish` deletes the marker. `update` preserves visibility.
- Owner bearer token permits mutations and listing. A separate private-read bearer permits only `GET`/`HEAD` of document content. Public anonymous reads require a present marker.
- Marker-check errors fail closed with 502/503, never 404 and never public content.
- Never trust `Host`, `X-Forwarded-*`, cookies, client-supplied credentials, or Tailscale IP for access. Private access is decided only by bearer credential (owner/private-read) at the origin, or by the marker for anonymous reads.
- Invalid IDs and path traversal never become storage keys; only strict 22-character base64url IDs are accepted.
- No raw object routes. `/` and `/api/health` disclose no IDs. No secrets in logs or errors.
- Every HTML and status response carries `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and a restrictive CSP: opaque-origin `sandbox allow-scripts`, inline scripts and styles allowed, inline event-handler attributes blocked, no forms, frames, network or external resources, `data:` images/fonts only (`default-src 'none'; script-src 'unsafe-inline'; script-src-attr 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; sandbox allow-scripts`).
- `HEAD`, `Range`, and conditional requests (`If-None-Match`, `If-Modified-Since`, `Range`) cannot bypass access: markers are checked before any content handling, ranges are ignored (full bounded body or `416` is never used to leak existence beyond the access decision).

## Deployment environment variables

| Variable                 | Required      | Description                                                                                                                          |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `AHA_OWNER_TOKEN`        | yes (service) | Owner bearer credential for mutations and listing.                                                                                   |
| `AHA_PRIVATE_READ_TOKEN` | yes (service) | Private-read bearer for document `GET`/`HEAD` only. Distinct from owner token.                                                       |
| `R2_ACCESS_KEY_ID`       | yes           | R2 S3 access key.                                                                                                                    |
| `R2_SECRET_ACCESS_KEY`   | yes           | R2 S3 secret. Secret, never logged.                                                                                                  |
| `R2_BUCKET`              | yes           | Private bucket name (`aha-prod` / `aha-dev`).                                                                                        |
| `R2_ENDPOINT`            | yes           | S3-compatible endpoint, e.g. `https://<account>.r2.cloudflarestorage.com`.                                                           |
| `R2_REGION`              | no            | S3 region label, default `auto`.                                                                                                     |
| `AHA_PUBLIC_URL`         | no            | Canonical share-URL base returned by the service and CLI, default `https://aha.oox.sh`.                                              |
| `AHA_UPSTREAM_URL`       | gateway only  | Fixed `https:` upstream origin for the private gateway (a deployment alias distinct from `aha.oox.sh` to avoid split-DNS recursion). |
| `AHA_PRIVATE_READ_TOKEN` | gateway only  | Injected server-side by the gateway; client credentials are stripped.                                                                |
| `PORT`                   | dev only      | Local server port (default `3939`).                                                                                                  |

See `.env.example` for placeholders. Never commit real values, Alchemy state (`.alchemy/`), Vercel metadata (`.vercel/`), or real ahas.

## Alchemy (R2 provisioning)

Infrastructure lives under `infra/` as a separate package (own dependencies) so core never imports Alchemy. It provisions private R2 buckets with retain-on-teardown and separate prod/dev names.

```sh
cd infra
pnpm install
pnpm run plan    # dry run, secrets redacted
pnpm run deploy  # operator-authorized only
```

No destructive default command. `forceDestroy` stays `false`; destroying a non-empty bucket fails rather than deleting data. See `infra/README.md`.

## Tailscale split-DNS and private gateway

The same browser URL `https://aha.oox.sh` resolves publicly via Vercel on public DNS and privately via the gateway on the tailnet (split DNS). Trust comes from the credential at the origin, not the hostname.

Generic setup (no real machine names, IPs, or tailnet identifiers):

1. Run the gateway on a tailnet node with loopback bind only:
   ```sh
   AHA_UPSTREAM_URL=https://aha-origin.oox.sh \
   AHA_PRIVATE_READ_TOKEN=<private-read-token> \
   pnpm gateway -- --port 3938
   ```
   The gateway binds `127.0.0.1` only, permits only `GET`/`HEAD` document paths (`/<id>`), rejects `/api/*` and proxy-style paths, strips incoming `Authorization`/`Cookie`/forwarded headers, injects the private-read credential server-side, and refuses upstream redirects instead of forwarding the credential.
2. Put Caddy (or equivalent) on the same node as a TLS-terminating reverse proxy in front of `127.0.0.1:3938`, serving `aha.oox.sh` with tailnet-only DNS.
3. Configure split DNS: public DNS for `aha.oox.sh` points at Vercel; tailnet DNS for `aha.oox.sh` points at the Caddy node. The upstream alias must differ from `aha.oox.sh` so the gateway never recurses into split DNS.
4. Verify: off-tailnet `curl https://aha.oox.sh/<id>` requires the marker; on-tailnet the same URL returns private content via the gateway. Forged `Host`/`X-Forwarded-For`/Tailscale-IP headers grant nothing.

See `docs/` for details. No host changes are made by this repository.

## Agent skill

`SKILL.md` contains a short agent skill: write a self-contained static HTML file, upload privately with the CLI, share the `https://aha.oox.sh/<id>` URL, publish only on explicit owner instruction. `templates/note.html` (short note) and `templates/plan.html` (long document) are the reference documents for the house style: copy the stylesheet, change the content. `fixtures/sample.html` is synthetic, non-sensitive sample content.

## Validation

`pnpm verify` runs format check, typecheck, lint, tests and build. Tests cover absent/present/deleted markers, owner/private-read/public separation, storage-unavailable denial, `HEAD`/range/conditional handling, path traversal and invalid IDs, upload limits including absent/wrong `Content-Length`, invalid/missing config, update visibility preservation, private proxy path/redirect/header restrictions, CLI parsing and JSON output, and a Node HTTP smoke lifecycle. CI runs frozen install, `pnpm verify`, an offline Vercel function build, and isolated infrastructure checks, all without deployment credentials. See [the platform build gate](docs/deployment.md#platform-build-gate).
