# RKC public media cache

Isolated source for the RKC Cloudflare Worker media route. This source is paired with PR #300 (public article list) and PR #321 (public media delivery). It is not deployed to production by this branch.

## Public delivery coverage

- Article list: the Worker returns published article data and rewrites cover, cover thumbnail and banner URLs.
- Article detail: src/app/pages/MateriaDetalhes.tsx rewrites the hero, inline content_blocks images, legacy HTML image URLs, materia_galeria image URLs and interview thumbnails.
- Projects: projectRepository.ts rewrites public Drive URLs used by project covers and project galleries.
- The URL helper only rewrites the configured Supabase origin and the exact /functions/v1/drive-media?id=<allowlisted-public-slug> shape. Supabase Storage URLs, external URLs and unknown IDs are left unchanged.
- The Worker accepts only the current public slug namespaces (materia-, projetos-, projeto-, kalucast-). The Supabase origin remains the authority for visibility, status and entity linkage.

## Authorization and cache behavior

- Every incoming /media request executes the Worker. Its outer response is always Cache-Control: no-store, preventing Workers Cache from serving a response before the authorization code runs.
- Before reading media bytes from cache, the Worker makes an authorization-only GET probe to drive-media, using the authorize=1 query parameter and Range: bytes=0-0. Supabase Edge Functions support GET, not HEAD. The updated function returns 204 + no-store only after checking public visibility, active/deleted state, publication status and the media's current relationship to the published article/project. The probe does not download the original Drive file.
- During rollout only, the Worker also accepts the existing origin's exact legacy HEAD response (200 with public, max-age=0, s-maxage=0, must-revalidate). That legacy handler validates access but downloads the Drive object before suppressing the HEAD body; deploy the updated Edge Function to remove this transitional cost.
- Only after successful authorization does the Worker make a full GET subrequest to drive-media with Workers Caching enabled, cacheEverything, a 60-second TTL and per-media/global cache tags. The subrequest cache can return image bytes without a second image transfer from the Supabase Edge Function/Google Drive.
- The Worker response itself is never cached. A cache HIT still executes the small authorization probe, so total drive-media invocations do not necessarily decrease; the large GET/media-byte transfers do. Measure these separately in Supabase logs.
- Only 200 JPEG, PNG and WebP origin responses are marked as cacheable. Other content and errors are returned with no-store.
- Byte-range requests are sliced from the cached full image response and returned as 206; the origin cache key remains the full image URL.

## Revocation and invalidation

- If the media was removed, replaced, unpublished, marked private/deleted, or is no longer linked, the authorization probe returns 404 and the Worker stops before the cached GET subrequest. This remains true even if the cache purge fails or the stale object remains in Cloudflare.
- If the authorization service is unavailable or returns an unexpected response, the Worker fails closed with 503. It never falls back to stale cached bytes.
- POST /__cache/purge is protected by RKC_CACHE_PURGE_SECRET, validates allowed tags and calls ctx.cache.purge({ tags }).
- supabase/functions/cloudflare-cache-purge is the authenticated bridge. It validates the Supabase user and RKC editorial role before calling the Worker.
- Matter save/unpublish/media replacement and project save/gallery removal invoke the bridge. Purge remains useful for cleanup/performance, but is no longer the authorization boundary.

## Tests and staging

Automated tests cover JPEG/PNG/WebP cache subrequests, HIT/MISS behavior, authorization failure, private media, simulated revocation with failed purge, legacy HEAD compatibility, byte ranges and purge authentication/failure.

The normal PR workflows run the automated unit/type/build checks. A manual GitHub Actions workflow accepts the URL of an isolated temporary Worker and runs the real HTTPS smoke test. For this mission, a temporary Worker with its own random purge secret was provisioned, tested and deleted. The staging Worker used the existing Supabase project only for read-only media validation and never targeted the production Worker. The live HTTP test was blocked because Supabase returned 402 with the explicit restriction code exceed_egress_quota.

    node --test tests/cloudflare-public-media-cache.test.mjs tests/public-media-url.test.mjs tests/drive-media-visibility.test.mjs tests/cloudflare-cache-purge-auth.test.mjs
    RKC_MEDIA_WORKER_URL=<isolated-staging-worker> node scripts/test-cloudflare-public-media.mjs

## Free-tier and operational limits

- Workers Caching and tag purge use Cloudflare's Workers Cache feature. The Worker is intentionally configured without R2, KV, DNS changes or paid services.
- Workers Cache purge is subject to Cloudflare Free-tier limits (the API reports failure if rate-limited). Purge failure does not grant access to stale bytes because authorization is performed before each cache read.
- Cache TTL is 60 seconds for performance and storage hygiene, not as a security revocation guarantee.
- The exact subscribed Cloudflare plan still needs independent confirmation if Billing Read permission is unavailable.
- Existing large images are not converted by this change. New uploads retain the existing optimization behavior; original Drive files are not modified.

## Rollout and rollback

- Deploy the Worker and updated drive-media Edge Function only after automated checks, staging HTTPS tests and security checks pass.
- Rollback by restoring the previous Worker version and previous drive-media Edge Function version. Keep the previous deployment identifiers before rollout.
- The new Worker is backward-compatible with the existing HEAD response during controlled staging, but the updated drive-media function is required to avoid a Drive download on every authorization probe.
