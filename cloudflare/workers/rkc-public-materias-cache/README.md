# RKC public media cache (isolated)

This Worker source is the cache implementation proposed for the RKC public article media path.

## Behavior

- Accepts only GET requests to `/media?id=materia-...`.
- Calls the existing Supabase `drive-media` function on an edge-cache miss. That function remains authoritative for public visibility and linkage to a published article.
- Only HTTP 200 JPEG, PNG, and WebP responses are cacheable, with a 60-second shared TTL.
- Uses the existing Worker's **Workers Cache** response caching, which is enabled on the Cloudflare account resource. It deliberately does not use `caches.default`; Cloudflare documents that Cache API behavior differs from Workers Cache and does not provide the same workers.dev support.
- Range, non-image, non-200, non-public-looking IDs and HEAD are not cacheable.
- `CF-Cache-Status` and `Age` from the platform are the authoritative indicators for edge HIT/MISS. The Worker does not forge those headers.

## Important limitation

- The 60-second TTL bounds the stale-publication window. It is not instantaneous global invalidation. Before extending TTL, connect unpublish/media-replacement events to a verified purge mechanism across Cloudflare edge locations.
- The current list route rewrites cover, thumbnail and banner fields. Article body/gallery image URLs must be audited and routed separately if they account for material `drive-media` traffic.
- Never cache private Drive media.

## Tests

Run:

```sh
node --test tests/cloudflare-public-media-cache.test.mjs
```

No DNS, route, Supabase, production Worker, R2, or billing configuration is changed by this source-only branch.
