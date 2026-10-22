# Deployment

## Cloudflare Worker

`infra/alchemy.run.ts` provisions, per stage:

| Stage           | Bucket     | Worker     | Hostname         |
| --------------- | ---------- | ---------- | ---------------- |
| `prod`          | `aha-prod` | `aha-prod` | `aha.o-o.co`     |
| everything else | `aha-dev`  | `aha-dev`  | `aha-dev.o-o.co` |

- The Worker binds the bucket as `AHA_BUCKET`, gets `AHA_PUBLIC_URL`, and
  stores `AHA_OWNER_TOKEN` as a secret read from the deploying shell (or
  `--env-file`). There are no R2 API keys in the Worker.
- The `o-o.co` zone must be in the same Cloudflare account as the bucket;
  Cloudflare creates the DNS record and certificate for the custom domain.
- Workers accept request bodies up to 100 MB on Free and Pro zones, hence
  the 95 MiB page limit. Responses stream without a size limit.
- Deploys, bucket creation and secret changes are operator actions:

  ```sh
  cd infra
  pnpm install --frozen-lockfile
  AHA_OWNER_TOKEN=... pnpm exec alchemy plan --stage dev --profile <profile>
  AHA_OWNER_TOKEN=... pnpm exec alchemy deploy --stage dev --profile <profile>
  ```

- `pnpm dev` (root) runs the dev stage locally under `alchemy dev`.

## Smoke test after a deploy

Use synthetic pages only, against the dev stage first:

1. `aha upload` a page over 5 MB, then `aha read` it back.
2. Upload the same name again: 409. Upload a file over 95 MiB: refused by the
   CLI; a raw request with a real body over 95 MiB returns 413. (Cloudflare's
   edge itself answers 400 when a body is shorter than its `Content-Length`,
   and adds `Content-Length` to small chunked uploads before the Worker runs.)
3. Private page: 404 in a fresh browser. `aha pair`, open the link, press the
   button, reload the page: it shows.
4. `aha publish`: a private window shows it. `aha unpublish`: 404 again.
5. `aha devices`, then `aha unpair <id>`: the paired browser gets 404.

## Legacy `aha.oox.sh`

The root `vercel.json` only redirects `aha.oox.sh/*` (and the
`aha-origin.oox.sh` alias) to `aha.o-o.co/*` with a 308, keeping path and
query. The Vercel project has no environment variables and no functions. The
former tailnet gateway, split DNS and R2 API token are retired.
