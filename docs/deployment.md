# Deployment

## Vercel

- Connect this repository as framework **Other**, Node 24, with `pnpm run build`.
  Vercel also compiles `api/**/*.ts` as Node 24 serverless functions. Keep
  `.npmrc`'s hoisted dependency layout: the Vercel TypeScript compiler cannot
  resolve the SDK's transitive Smithy declarations with pnpm's isolated linker.
  Do not disable strict checking or add casts to hide this resolution failure.
- Set `AHA_OWNER_TOKEN`, `AHA_PRIVATE_READ_TOKEN`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
  (`R2_REGION` optional, default `auto`) in the project environment.
- `vercel.json` routes `/` to a static greeting, `/api/health` to a health
  check, `/api/...` to document functions, and `/:id` (strict 22-character
  base64url) to the public document function. No raw object routes exist.
- Attach the `aha.oox.sh` domain after review. The R2 bucket and any direct
  access domains stay private and disabled.

## Platform build gate

CI runs `pnpm verify`, then a real Vercel function build using synthetic project
settings in `fixtures/vercel-project.json` and an empty auth directory. No
Vercel credentials, R2 credentials, environment pull, or deployment are needed.
The fixture is for CI only; never replace a real project's `.vercel/project.json`
with it. This catches platform-specific compiler failures the ordinary build
cannot detect.

Before an authorized live deployment, run `vercel build` in a linked checkout
with the intended environment. Build success alone does not prove live R2
permissions, custom-domain routing, TLS, or split DNS; verify those separately.

## Private gateway and split DNS

The gateway (`gateway/`) binds `127.0.0.1` only and forwards credentialed
reads to a fixed `https:` upstream alias that must differ from
`aha.oox.sh` (otherwise split DNS would recurse the gateway into itself).

1. On a tailnet node, run:

   ```sh
   AHA_UPSTREAM_URL=https://aha-origin.oox.sh \
   AHA_PRIVATE_READ_TOKEN=<private-read-token> \
   pnpm gateway -- --port 3938
   ```

2. Terminate TLS for `aha.oox.sh` in front of `127.0.0.1:3938` with a
   tailnet-only reverse proxy (for example Caddy with a `reverse_proxy`
   to `127.0.0.1:3938`).
3. Serve `aha.oox.sh` from public DNS to Vercel and from tailnet DNS to
   the proxy. The origin decides access by bearer credential or publication
   marker, never by hostname, headers, or client IP.

`AHA_GATEWAY_INSECURE_LOOPBACK=1` permits `http:` loopback upstreams for
local tests and development only. Production stays `https:`-only.
