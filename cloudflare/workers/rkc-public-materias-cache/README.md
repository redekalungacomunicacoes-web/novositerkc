# RKC public media cache (isolated)

This Worker source is the cache implementation proposed for the RKC public article media path.

## Behavior

- Accepts only GET requests to `/media?id=materia-...`.
- Calls the existing Supabase `drive-media` function on a cache miss. That function remains the authority that verifies public visibility and linkage to a published article.
- Stores only HTTP 200 JPEG, PNG, and WebP responses using the Workers Cache API.
- Uses a 60-second edge TTL as a conservative revocation window while an explicit global invalidation hook is not yet wired into the publishing workflow.
- Does not cache private IDs, non-image responses, HEAD, or Range responses.
- Adds `X-RKC-Media-Cache: HIT|MISS` for validation and monitoring.

## Important limitation

A Cache API hit does not re-run the Supabase visibility check until the 60-second TTL expires. Therefore this is not immediate revocation. Before production rollout, connect article unpublish/media replacement events to a server-side invalidation mechanism, or keep the TTL at 60 seconds and explicitly accept that bounded window. Never cache private Drive media.

## Tests

Run:

```sh
node --test tests/cloudflare-public-media-cache.test.mjs
```

No DNS, route, Supabase, production Worker, R2, or billing configuration is changed by this source-only branch.
