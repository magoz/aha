# Plans publishing skill

Publish a self-contained static HTML file with the `plans` CLI. Documents are
private by default; publish only on explicit owner instruction.

## Workflow

1. Write one self-contained `.html` file: inline `<style>` only, no
   `<script>`, no forms, no frames, no external resources. Keep it under 2 MiB.
2. Upload privately and capture the URL:

   ```sh
   plans upload ./page.html
   # prints {"id":"<id>","url":"https://plans.oox.sh/<id>","etag":"..."}
   ```

   The share URL is `https://plans.oox.sh/<id>`. Anonymous off-tailnet reads
   return 404 until published. Private tailnet reads require the configured
   gateway and split DNS; an upload does not configure that infrastructure.

3. Share the URL. The owner publishes explicitly:

   ```sh
   plans publish <id>
   plans unpublish <id>
   ```

## Rules

- Never publish or unpublish without an explicit owner instruction.
- Keep secrets and credentials out of uploaded pages. Never commit real plans or
  private documents to the source repository.
- Updates replace content in place and preserve visibility:

  ```sh
  plans update <id> ./page.html [--if-match <etag>]
  ```

- Read back with `plans read <id> [--output out.html]`; list with
  `plans list [--public] [--json]`.
- Configure via `--endpoint`/`PLANS_ENDPOINT` (default
  `https://plans.oox.sh`; loopback `http:` only for development) and
  `--token`/`PLANS_OWNER_TOKEN`. On split-DNS tailnets, set the endpoint
  to the public deployment alias (the gateway at the default URL rejects
  `/api/*`); share links still use `PLANS_PUBLIC_URL`
  (default `https://plans.oox.sh`).
