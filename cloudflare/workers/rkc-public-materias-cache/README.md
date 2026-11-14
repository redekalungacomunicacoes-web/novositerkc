# RKC public media cache

Isolated source for the RKC Cloudflare Worker media route. This source is paired with PR #300 (public article list) and PR #321 (public media delivery). It is not deployed to production by this branch.

## Public delivery coverage

- Article list: the Worker returns published article data and rewrites cover, cover thumbnail and banner URLs.
- Article detail: src/app/pages/MateriaDetalhes.tsx rewrites the hero, inline content_blocks images, legacy HTML image URLs, materia_galeria image URLs and interview thumbnails.
- Projects: projectRepository.ts rewrites public Drive URLs used by project covers and project galleries.
- The URL helper only rewrites the configured Supabase origin and the exact /functions/v1/drive-media?id=<allowlisted-public-slug> shape. Supabase Storage URLs, external URLs and unknown IDs are left unchanged.
- The Worker accepts only the current public slug namespaces (materia-, projetos-, projeto-, kalucast-). The Supabase origin remains the authority for visibility, status and entity linkage.

## Authorization and cache behavior

- Every incoming /media request executes the default gateway. Its outer response is always Cache-Control: no-store, so the gateway response itself is never cached.
- Before reading media bytes from cache, the gateway makes an authorization-only GET probe to drive-media, using the authorize=1 query parameter and Range: bytes=0-0. Supabase Edge Functions support GET, not HEAD. The updated function returns 204 + no-store only after checking public visibility, active/deleted state, publication status and the media's current relationship to the published article/project. It also returns the current drive_files.updated_at as a non-sensitive media-version header. The probe does not download the original Drive file.
- During rollout only, the gateway accepts the existing origin's legacy Range response (206 with Content-Range bytes 0-0/<size> and s-maxage=0). The current function validates access and transfers only one byte for this probe; deploy the updated Edge Function to return 204 without downloading Drive bytes.
- MediaCache is the only entrypoint that caches image bytes. Its cache key includes both the public media ID and the version returned by the fresh authorization probe. Replacing the same drive_files row changes updated_at and therefore changes the cache key, so an old cached object is no longer addressable even if purge fails. Only after successful authorization does the gateway call the named MediaCache entrypoint through ctx.exports. Workers Caching is enabled on that entrypoint, which fetches the full image on MISS and returns Cache-Control: public, max-age=60 plus Cache-Tag. On HIT, Cloudflare serves the cached image without invoking MediaCache.fetch or transferring the image again from Supabase/Google Drive.
- The gateway response itself is never cached, while the inner MediaCache entrypoint is. A HIT still executes the small authorization probe, so the number of drive-media authorization invocations remains one per request; full image GETs to drive-media occur only on cache MISS. Report these two request types separately rather than claiming that total function invocations fall.
- Only 200 JPEG, PNG and WebP origin responses are marked as cacheable. Other content and errors are returned with no-store.
- Byte-range requests are sliced from the cached full image response and returned as 206; the origin cache key remains the full image URL.

## Revocation and invalidation

- If the media was removed, replaced, unpublished, marked private/deleted, or is no longer linked, the authorization probe returns 404 and the Worker stops before the cached GET subrequest. This remains true even if the cache purge fails or the stale object remains in Cloudflare.
- If the authorization service is unavailable or returns an unexpected response, the Worker fails closed with 503. It never falls back to stale cached bytes.
- POST /__cache/purge is protected by RKC_CACHE_PURGE_SECRET and validates allowed tags. Media tags are purged through the MediaCache entrypoint's own ctx.cache.purge({ tags }); the article-list tag is purged from the default entrypoint cache.
- supabase/functions/cloudflare-cache-purge is the authenticated bridge. It validates the Supabase user and RKC editorial role before calling the Worker.
- Matter save/unpublish/media replacement and project save/gallery removal invoke the bridge. Purge remains useful for cleanup/performance, but is no longer the authorization boundary.

## Tests and staging

Automated tests cover JPEG/PNG/WebP cache subrequests, HIT/MISS behavior, authorization failure, private media, simulated revocation with failed purge, legacy HEAD compatibility, byte ranges and purge authentication/failure.

The normal PR workflows run the automated unit/type/build checks. A manual GitHub Actions workflow accepts the URL of an isolated temporary Worker and runs the real HTTPS smoke test. For this mission, a temporary Worker with its own random purge secret was provisioned, tested and deleted. The staging Worker used the existing Supabase project only for read-only media validation and never targeted the production Worker. The live HTTP test was blocked because Supabase returned 402 with the explicit restriction code exceed_egress_quota.

    node --test tests/cloudflare-public-media-cache.test.mjs tests/public-media-url.test.mjs tests/drive-media-visibility.test.mjs tests/cloudflare-cache-purge-auth.test.mjs
    RKC_MEDIA_WORKER_URL=<isolated-staging-worker> node scripts/test-cloudflare-public-media.mjs

## Free-tier and operational limits

- Workers Caching and tag purge use Cloudflare's Workers Cache feature, with a separate named entrypoint for media delivery. Wrangler 4.107.0 or newer is required for per-entrypoint caching. The Worker is intentionally configured without R2, KV, DNS changes or paid services.
- Workers Cache purge is subject to Cloudflare Free-tier limits (the API reports failure if rate-limited). Purge failure does not grant access to stale bytes because authorization is performed before each cache read.
- Cache TTL is 60 seconds for performance and storage hygiene, not as a security revocation guarantee.
- The exact subscribed Cloudflare plan still needs independent confirmation if Billing Read permission is unavailable.
- Existing large images are not converted by this change. New uploads retain the existing optimization behavior; original Drive files are not modified.

## Rollout and rollback

- Deploy the Worker and updated drive-media Edge Function only after automated checks, staging HTTPS tests and security checks pass.
- Rollback by restoring the previous Worker version and previous drive-media Edge Function version. Keep the previous deployment identifiers before rollout.
- The new Worker is backward-compatible with the existing HEAD response during controlled staging, but the updated drive-media function is required to avoid a Drive download on every authorization probe.
