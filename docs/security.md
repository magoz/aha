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
- IDs are 128-bit base64url (`[A-Za-z0-9_-]{22}`). Anything else never
  becomes a storage key.
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
  `Content-Security-Policy` with `sandbox` and no scripts, forms, frames,
  or network (inline styles and `data:` images/fonts stay allowed).
