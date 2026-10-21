# Security model

- Private by default. `aha/<id>.html` holds content; an empty
  `public/<id>` object marks a document public. Missing marker means private.
  The bucket has no public access, no `r2.dev` domain and no custom domain;
  only the Worker reads it, through its binding. The Worker answers only on
  its custom domain (`workersDev: false`: no `workers.dev` or per-version
  preview URLs that could keep old code or secrets reachable).
- Anonymous `GET`/`HEAD /<id>` succeed only when the marker is present.
  Marker reads happen before content reads; any storage error denies
  (HTTP 502 for page reads, never content, never a bare 404 that would be
  misread as "not public, retry").
- The owner bearer allows mutations, listing, publishing, pairing and
  managing paired browsers. Browsers never send it on their own, so a
  cookie-bearing cross-site request cannot reach any of those actions.
- Paired browsers may only read pages (`GET`/`HEAD /<id>`), public or
  private. Pairing:
  - `aha pair` (owner) creates a random 16-byte code valid for 10 minutes and
    prints `https://aha.o-o.co/pair/<code>`.
  - `GET /pair/<code>` only shows a button, so chat-app link previews cannot
    use the code. `POST` uses it up, even when expired, and sets a random
    32-byte session token as `__Host-aha-session` (`Secure`, `HttpOnly`,
    `SameSite=Lax`, `Path=/`, no `Domain`). The code is claimed with a
    conditional write before it is deleted, so two concurrent `POST`s pair at
    most one browser.
  - R2 stores only SHA-256 hashes (`pairing/<hash>`, `session/<hash>`), so a
    leaked listing cannot be replayed as a code or cookie. Every page view by
    a paired browser looks the session up (fail closed) and renews the
    cookie, up to the 400-day browser cap. Sessions have no server-side
    expiry by design (pair once); revoke lost or old browsers with
    `aha unpair`.
  - `aha devices` lists sessions (label from the User-Agent, for display
    only); `aha unpair <id>` / `--all` revokes them immediately.
  - `SameSite=Lax` sends the cookie on top-level navigations from other
    apps, so private links open; subresource and script requests from other
    sites do not carry it. Pages are served with `sandbox allow-scripts`
    (opaque origin) and `connect-src` defaulting to `'none'`, so a page's
    scripts can neither read the cookie nor fetch other pages with it.
  - Unpaired browsers get the same 404 for private, missing and invalid
    pages.
- `Host`, `X-Forwarded-*`, client IPs and DNS grant nothing.
- IDs are readable names chosen by the owner at upload (new names:
  lowercase letters, digits and single dashes, up to 80 characters; `api`
  is reserved). Older random 22-character IDs remain valid. Only
  `[A-Za-z0-9_-]{1,80}` ever becomes a storage key. Uploads are create-only
  (conditional `If-None-Match: *` on the R2 put), so a taken name returns
  409 and never overwrites. A name with a leftover `public/<id>` marker also
  counts as taken, so a later upload does not inherit it; `aha unpublish
<id>` clears a leftover marker. Concurrent publish, delete and re-upload
  of one name are not transactional; the owner should not run them at the
  same time.
- Names are guessable, so a public document is readable by anyone who
  guesses or receives its URL. Privacy comes only from the missing marker,
  never from the ID being secret.
- Uploads are bounded to 95 MiB. The request must declare `Content-Length`
  (411 otherwise); declarations over the limit are rejected (413) before
  storage, and the body streams into R2 through a fixed-length stream, so a
  body longer or shorter than declared fails and nothing is stored. Only
  `text/html` is accepted and served.
- Updates require the document to exist (no implicit creation), preserve
  the marker, and honor `If-Match` (412 on mismatch; latest-write wins
  without it). Deletes require the document to be unpublished (409 while
  published).
- Every document and status response carries `Cache-Control: no-store`,
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and a
  restrictive `Content-Security-Policy` with `sandbox allow-scripts` (opaque
  origin, no cookies/storage access) that allows inline scripts and styles,
  blocks inline event-handler attributes, and forbids network, external
  resources, forms and frames (`data:` images/fonts stay allowed). Scripts
  can still navigate the page, so a hostile document could leak its own
  content via a URL; this is accepted because the owner is the only author.
- The pairing page is the only HTML the Worker writes itself. It has no
  scripts and its CSP allows only inline styles and a same-origin form post.
