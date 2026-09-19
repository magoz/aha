# Deployment

## Vercel

- Connect this repository. No build command is required for the service;
  Vercel compiles `api/**/*.ts` as Node 24 serverless functions.
- Set `PLANS_OWNER_TOKEN`, `PLANS_PRIVATE_READ_TOKEN`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
  (`R2_REGION` optional, default `auto`) in the project environment.
- `vercel.json` routes `/` to a static greeting, `/api/health` to a health
  check, `/api/...` to document functions, and `/:id` (strict 22-character
  base64url) to the public document function. No raw object routes exist.
- Attach the `plans.oox.sh` domain after review. The R2 bucket and any direct
  access domains stay private and disabled.

## Private gateway and split DNS

The gateway (`gateway/`) binds `127.0.0.1` only and forwards credentialed
reads to a fixed `https:` upstream alias that must differ from
`plans.oox.sh` (otherwise split DNS would recurse the gateway into itself).

1. On a tailnet node, run:

   ```sh
   PLANS_UPSTREAM_URL=https://plans-private-alias.example.com \
   PLANS_PRIVATE_READ_TOKEN=<private-read-token> \
   pnpm gateway -- --port 3938
   ```

2. Terminate TLS for `plans.oox.sh` in front of `127.0.0.1:3938` with a
   tailnet-only reverse proxy (for example Caddy with a `reverse_proxy`
   to `127.0.0.1:3938`).
3. Serve `plans.oox.sh` from public DNS to Vercel and from tailnet DNS to
   the proxy. The origin decides access by bearer credential or publication
   marker, never by hostname, headers, or client IP.

`PLANS_GATEWAY_INSECURE_LOOPBACK=1` permits `http:` loopback upstreams for
local tests and development only. Production stays `https:`-only.
