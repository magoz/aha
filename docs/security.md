# Security model

- Private by default. `aha/<id>.html` holds content; an empty
  `public/<id>` object marks a document public. Missing marker means private.
- Anonymous `GET`/`HEAD /<id>` succeed only when the marker is present.
  Marker reads happen before content reads; any storage error denies
  (HTTP 502 for public reads, never content, never a bare 404 that would be
  misread as "not public, retry").
- The owner bearer allows mutations and listing. The private-read bearer
  allows `GET`/`HEAD` of content only. The two tokens must differ.
- `Host`, `X-Forwarded-*`, cookies, and client Tailscale IPs grant nothing.
- IDs are readable names chosen by the owner at upload (new names:
  lowercase letters, digits and single dashes, up to 80 characters; `api`
  is reserved). Older random 22-character IDs remain valid. Only
  `[A-Za-z0-9_-]{1,80}` ever becomes a storage key. Uploads are create-only
  (conditional `If-None-Match: *`), so a taken name returns 409 and never
  overwrites. A name with a leftover `public/<id>` marker also counts as
  taken, so a later upload does not inherit it; `aha unpublish <id>` clears
  a leftover marker. Concurrent publish, delete and re-upload of one name
  are not transactional; the owner should not run them at the same time.
- Names are guessable, so a public document is readable by anyone who
  guesses or receives its URL. Privacy comes only from the missing marker,
  never from the ID being secret.
- Uploads are bounded to 2 MiB with server-side byte accounting; declared
  `Content-Length` values over the limit are rejected before storage, and
  actual bodies are re-checked. Only `text/html` is accepted and served.
- Updates require the document to exist (no implicit creation), preserve
  the marker, and honor `If-Match` (412 on mismatch; latest-write wins
  without it). Deletes require the document to be unpublished (409 while
  published).
- The gateway only proxies `GET`/`HEAD /<id>`, strips client credentials,
  cookies, and forwarded headers, injects the private-read token
  server-side, and refuses upstream redirects instead of following them.
- Every response carries `Cache-Control: no-store`, `Referrer-Policy:
no-referrer`, `X-Content-Type-Options: nosniff`, and a restrictive
  `Content-Security-Policy` with `sandbox allow-scripts` (opaque origin, no
  cookies/storage access) that allows inline scripts and styles, blocks
  inline event-handler attributes, and forbids network, external resources,
  forms and frames (`data:` images/fonts stay allowed). Scripts can still
  navigate the page, so a hostile document could leak its own content via
  a URL; this is accepted because the owner is the only author.
