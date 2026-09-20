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
- An account-owned `${bucketName}-service` API token with only R2 Bucket Item
  Read and Write permission for that stage's bucket. Its secret is kept in
  private Alchemy state, not printed as a stack output. Credential creation
  requires Cloudflare's account-level **API Tokens > Write** permission;
  being able to create buckets does not imply this permission. If the token
  resource returns `9109` (`Unauthorized to access requested resource`), check
  the profile's token-management permission before retrying.
- `forceDestroy: false` plus `RemovalPolicy.retain()`: tearing down the
  stack never deletes bucket contents. Destroying a non-empty bucket fails
  instead of deleting data.

## Usage (operator authorization required)

```sh
cd infra
pnpm install --frozen-lockfile
pnpm typecheck
pnpm exec alchemy plan --stage prod --profile cloudflare-infra
pnpm exec alchemy deploy --stage prod --profile cloudflare-infra --yes # operator-approved only
```

`cloudflare-infra` is the local provisioning profile used in this example;
substitute your own authorized profile. Keep prod/dev stages separate. A new
profile must point at the same account and state backend before managing an
existing stack; review the plan for unexpected bucket recreation.

Authenticate with `pnpm exec alchemy login --configure --profile cloudflare-infra`
and choose API Token. The provisioning token needs Account API Tokens Edit and
Workers R2 Storage Edit for the selected account. Its permissions are
account-wide, unlike the bucket-scoped application token it creates. Do not put
the provisioning token in Vercel. Reusing an existing state backend avoids
requiring additional Workers/Secrets Store bootstrap permissions.

Alchemy stores profile configuration under `~/.alchemy/profiles.json` and
credentials under `~/.alchemy/credentials/`, never in this repository. Keep
credential files owner-readable only. Local `.alchemy/` artifacts are git-ignored.

## Application credentials

Cloudflare's S3 access key ID is the account token's `tokenId`; the secret access
key is the SHA-256 hex digest of its token `value`. Store these as production
secrets `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Vercel. These are not the
Cloudflare provisioning token or the Plans CLI owner token.

The resource retains its secret in private Alchemy state, so a no-op deploy does
not rotate it. **`alchemy state get` can expose plaintext secrets** despite the
`__redacted__` field name in its JSON output. Consume that output only through a
secure process-to-process handoff; never paste it into chat, logs, or source.
Verify the credential with a synthetic private object and delete that object
after testing. Credential creation and Vercel environment updates do not deploy
the application.

There is intentionally no destroy script. Run `alchemy destroy` only as an
explicit, operator-confirmed action, knowing buckets are retained.
