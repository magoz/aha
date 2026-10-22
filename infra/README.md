# aha infrastructure (Alchemy)

Operator-run Cloudflare provisioning (R2 bucket and Worker). This package is intentionally
separate from the application: it has its own dependencies
(`alchemy@2.0.0-beta.83` with stable `effect@4.0.5` and
`@effect/platform-node@4.0.5`; `pnpm-workspace.yaml` pins
`@effect/platform-node-shared` to the same release so Effect packages
never drift apart).
`pnpm-lock.yaml` is committed, so always install with
`pnpm install --frozen-lockfile`; CI re-runs frozen install, typecheck,
and `alchemy --help` to catch version drift. Core application code never
imports Alchemy.

## What it provisions

- One private R2 bucket per stage: `aha-prod` for stage `prod`,
  `aha-dev` otherwise. The bucket has no custom domain and no public access
  (`publicAccess: false` keeps the `r2.dev` domain disabled).
- One Worker per stage (`aha-prod` on `aha.o-o.co`, `aha-dev` on
  `aha-dev.o-o.co`) built from `../server/worker.ts`, with the bucket bound as
  `AHA_BUCKET`, `AHA_PUBLIC_URL`, and the secret `AHA_OWNER_TOKEN` read from
  the deploying shell (`AHA_OWNER_TOKEN=... pnpm exec alchemy deploy ...` or
  `--env-file`). Cloudflare creates the custom domain's DNS record and
  certificate; the `o-o.co` zone must be in the same account. `workersDev:
  false` disables the `workers.dev` and per-version preview URLs.
- `forceDestroy: false` plus `RemovalPolicy.retain()`: tearing down the
  stack never deletes bucket contents. Destroying a non-empty bucket fails
  instead of deleting data.

## Usage (operator authorization required)

```sh
cd infra
pnpm install --frozen-lockfile
pnpm typecheck
AHA_OWNER_TOKEN=... pnpm exec alchemy plan --stage dev --profile cloudflare-infra
AHA_OWNER_TOKEN=... pnpm exec alchemy deploy --stage dev --profile cloudflare-infra --yes # operator-approved only
```

`cloudflare-infra` is the local provisioning profile used in this example;
substitute your own authorized profile. Keep prod/dev stages separate. A new
profile must point at the same account and state backend before managing an
existing stack; review the plan for unexpected bucket recreation.

Authenticate with `pnpm exec alchemy login --configure --profile cloudflare-infra`
and choose API Token. The provisioning token needs Workers R2 Storage Edit and
Workers Scripts Edit for the account, plus Zone Read, DNS Edit and Workers
Routes Edit on `o-o.co` for the custom domains (the token's Zone Resources must
include `o-o.co`). The stack creates no API tokens, so Account API Tokens Edit
is not needed. Reusing an existing state backend avoids
requiring additional Workers/Secrets Store bootstrap permissions.

Alchemy stores profiles under `~/.alchemy/profiles/<name>/` and cached
state-store credentials under `~/.alchemy/credentials/<name>/`, never in this
repository. Upgrading from beta.74 migrates the old `profiles.json` layout and
moves `credentials/` into a `.profiles-v0-*` backup; copy each profile's
`cloudflare-state-store.json` back, or Alchemy offers to deploy a new state
store. Keep
credential files owner-readable only. Local `.alchemy/` artifacts are git-ignored.

## Secrets

The Worker's `AHA_OWNER_TOKEN` is the Aha CLI owner token (prod: the value in
`~/.config/aha/credentials`), never the provisioning token. Rotating it means
deploying with the new value and updating the CLI credentials file. **`alchemy
state get` can expose plaintext secrets** despite the `__redacted__` field name
in its JSON output; never paste it into chat, logs, or source.

There is intentionally no destroy script. Run `alchemy destroy` only as an
explicit, operator-confirmed action, knowing buckets are retained.
