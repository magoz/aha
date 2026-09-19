# plans infrastructure (Alchemy)

Operator-run Cloudflare R2 provisioning. This package is intentionally
separate from the application: it has its own dependencies
(`alchemy@2.0.0-beta.74` with `effect@4.0.0-rc.112` plus an explicit
`@effect/platform-node@4.0.0-rc.112` pin, a known compatible baseline;
`pnpm-workspace.yaml` additionally overrides
`@effect/platform-node-shared` to rc.112 because the caret range floats
to rc.116, which imports `effect/dist/ByteSize.js`, absent in effect
rc.112 — and floating effect itself to rc.116 instead breaks alchemy
beta.74, whose compiled code still calls the removed `Config.string` API).
`pnpm-lock.yaml` is committed, so always install with
`pnpm install --frozen-lockfile`; CI re-runs frozen install, typecheck,
and `alchemy --help` to catch version drift. Core application code never
imports Alchemy.

## What it provisions

- One private R2 bucket per stage: `plans-prod` for stage `prod`,
  `plans-dev` otherwise. No custom domains, no public access.
- `forceDestroy: false` plus `RemovalPolicy.retain()`: tearing down the
  stack never deletes bucket contents. Destroying a non-empty bucket fails
  instead of deleting data.

## Usage (operator authorization required)

```sh
cd infra
pnpm install
pnpm typecheck
pnpm plan     # dry run; review the plan, secrets stay redacted
pnpm deploy   # only with explicit operator approval
```

Select the stage with the CLI stage flag (see `pnpm alchemy plan --help`).
Authenticate first with `alchemy login` (inspect with `alchemy profile show`,
remove with `alchemy profile clear`); credentials live in
`~/.alchemy/profiles.json`, never in this repository. State under
`.alchemy/` is git-ignored.

There is intentionally no destroy script. Run `alchemy destroy` only as an
explicit, operator-confirmed action, knowing buckets are retained.
