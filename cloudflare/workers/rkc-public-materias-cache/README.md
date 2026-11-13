# RKC public media cache

Isolated source for the RKC Cloudflare Worker media route. This source is paired with PR #300 (public article list) and is not deployed by this branch.

## Public delivery coverage

- Article list: the Worker returns published article data and rewrites cover, cover thumbnail and banner URLs.
- Article detail: `src/app/pages/MateriaDetalhes.tsx` rewrites the hero, inline `content_blocks` images, legacy HTML image URLs, and `materia_galeria` image URLs.
- Projects: `projectRepository.ts` rewrites public Drive URLs used by project covers and project galleries.
- The URL helper only rewrites the configured Supabase origin and the exact `/functions/v1/drive-media?id=<allowlisted-public-slug>` shape. Supabase Storage URLs, external URLs and unknown IDs are left unchanged.
- The Worker accepts only the current public slug namespaces (`materia-`, `projetos-`, `projeto-`, `kalucast-`, `site-`, `team-`). The Supabase origin still validates visibility and active status.

## Cache behavior

- Only GET responses with status 200 and MIME JPEG, PNG or WebP are edge-cacheable.
- Media uses `Cache-Control: public, max-age=0, s-maxage=60`: browsers revalidate, while Workers Cache can reuse the response for 60 seconds.
- Each image is tagged `rkc-public-media` and `media-<public_slug>`; the article list JSON is tagged `rkc-public-materias`.
- Workers Cache is already enabled for the existing Worker, with cross-version cache disabled. The Worker response cache sits in front of the Worker code, so a HIT does not execute the Worker and does not invoke Supabase `drive-media`.
- Cloudflare handles byte-range requests against the cached full response; the Worker does not fetch a separate partial response.
- Errors, non-image payloads and HEAD responses are not stored.

## Invalidation

- `POST /__cache/purge` is an internal endpoint protected by `RKC_CACHE_PURGE_SECRET`. It accepts only the two global tags and per-media tags; it calls `ctx.cache.purge({ tags })`.
- `supabase/functions/cloudflare-cache-purge` is the authenticated bridge. It validates the Supabase user and the RKC editorial role before calling the Worker.
- Matter save/unpublish/media replacement and project save/gallery removal invoke the bridge. The call is best-effort and does not block editorial saves; if it is not configured, the 60-second TTL remains the fallback.
- Before enabling this flow, configure the same high-entropy secret as a Cloudflare Worker secret and a Supabase Edge Function secret named `RKC_CACHE_PURGE_SECRET`, then deploy the two source changes together.
- The `drive-media` source no longer caches file metadata for five minutes. It rechecks public/active/deleted status and the published entity relationship on every origin request. For articles/projects it returns `max-age=0, s-maxage=0, must-revalidate`; the Worker overrides this to its controlled 60-second edge TTL.

## Tests

```sh
node --test tests/cloudflare-public-media-cache.test.mjs tests/public-media-url.test.mjs tests/drive-media-visibility.test.mjs
node scripts/test-cloudflare-public-media.mjs
```

The live smoke test makes read-only GET requests to three existing public article images (JPEG, PNG and WebP), checks the second response is `CF-Cache-Status: HIT`, checks `Age` and identical bytes, and confirms an unknown/private control ID returns 404 + `no-store`.

## Important limits

- Cache invalidation is immediate only after the authenticated bridge is deployed and its two secrets are configured. Until then, the 60-second shared TTL is the maximum Worker edge staleness window; the origin still revalidates on each MISS.
- Browser caches are instructed to revalidate (`max-age=0`). A copy already downloaded by a visitor cannot be remotely erased from that visitor's device.
- Existing large images are not converted by this change. New uploads to the article pipeline already have client-side optimization; older assets and project upload optimization require a separate, carefully scoped task.
- No DNS, route, active Worker, Supabase project, database, Auth, Google Drive file, R2 resource, or billing setting is changed by this source-only PR.
