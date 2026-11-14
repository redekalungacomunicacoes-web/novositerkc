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
- POST /__cache/purge is protected by RKC_CACHE_PURGE_SECRET and validates allowed tags. The live staging probe showed tag-specific purge returning success without evicting the named MediaCache entrypoint. The current safe fallback purges the dedicated MediaCache entrypoint as a whole through its own ctx.cache.purge({ purgeEverything: true }); this can cause a cold media cache after content updates. The article-list tag remains scoped to the default entrypoint.
- supabase/functions/cloudflare-cache-purge is the authenticated bridge. It validates the Supabase user and RKC editorial role before calling the Worker.
- Matter save/unpublish/media replacement and project save/gallery removal invoke the bridge. Purge remains useful for cleanup/performance, but is no longer the authorization boundary.

## Tests and staging

Automated tests cover JPEG/PNG/WebP cache subrequests, HIT/MISS behavior, authorization failure, private media, simulated revocation with failed purge, byte ranges and purge authentication/failure.

**Execução atualizada de 14/11/2026:**
- Workers isolados de staging ativos: `rkc-media-origin-staging-20261114` e `rkc-media-cache-staging-20261114`. A origem é sintética e separada; nenhum arquivo original foi modificado.
- Workflow `43571727522`: todos os testes HTTPS de staging passaram. O workflow completo ficou vermelho apenas no gate de compatibilidade da Edge Function de produção v30.
- HIT/MISS: JPEG 413 bytes, PNG 69 bytes, WebP 60 bytes e galeria de projeto 413 bytes. Cada repetição retornou HIT com 0 bytes da origem. Economia sintética medida: **955 bytes**.
- Range: 206 correto, sem nova transferência no HIT. Mídia privada: 404. Revogação: 404 mesmo com purge inválido (401). Seis solicitações simultâneas retornaram corpos completos.
- Invalidação autorizada no Worker isolado: purge 200, próxima requisição MISS e nova transferência de 413 bytes. O teste mostrou que purge por tag devolvia sucesso sem esvaziar a entrada MediaCache; o fallback atual invalida toda a entrada MediaCache, mantendo a ponte autenticada e evitando servir cópias revogadas.
- A função isolada `drive-media-staging` v2 respondeu 204 + `no-store` para imagem pública, galeria de matéria, áudio de entrevista e galeria de projeto; mídia revogada retornou 404 + `no-store`; Range de imagem retornou 206. Há 7 registros privados sem `public_slug`, sem alteração dos registros.
- A ponte `cloudflare-cache-purge` foi implantada no projeto Supabase como v2, com `verify_jwt=true`. O endpoint rejeitou requisição sem JWT com 401. Os testes automatizados também cobrem usuários inválidos, papel não autorizado e segredo ausente.
- O workflow não contém a credencial temporária em texto; o segredo antigo de staging foi rotacionado e revogado. O valor antigo permanece no histórico de commits, sem possibilidade de autenticar.
- Logs de produção: zero HTTP 402 após 01:45 UTC de 14/11. A última resposta 402 encontrada foi às 01:41 UTC. Para `drive-media` v30, desde 01:45 UTC: 50 respostas 200 e 39 respostas 206, sem 5xx.
- O teste de produção confirma matérias, projetos, equipe, configurações públicas, pop-ups, Auth e páginas públicas sem 402. A consulta anônima a configurações restritas retorna 401, esperado. O shell SPA de `/admin` foi verificado, mas não houve sessão de administrador disponível para testar o painel autenticado.
- **Bloqueio atual:** a função de produção `drive-media` v30 ainda responde ao probe `authorize=1` com 206 e `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable`. O teste da função isolada v2 confirma o contrato novo 204 + `no-store`; a produção ainda não foi atualizada.
- O Worker de produção permanece na versão 4 e não possui o segredo `RKC_CACHE_PURGE_SECRET`. A função `cloudflare-cache-purge` v2 também aguarda esse segredo no Supabase.

Os workflows de validação do commit mais recente continuam em execução; nenhum deles foi mesclado ou publicado em Pages.

    node --test tests/cloudflare-public-media-cache.test.mjs tests/public-media-url.test.mjs tests/drive-media-visibility.test.mjs tests/cloudflare-cache-purge-auth.test.mjs
    RKC_MEDIA_WORKER_URL=<isolated-staging-worker> node scripts/test-cloudflare-public-media.mjs

## Free-tier and operational limits

- Workers Caching and tag purge use Cloudflare's Workers Cache feature, with a separate named entrypoint for media delivery. Wrangler 4.107.0 or newer is required for per-entrypoint caching. The Worker is intentionally configured without R2, KV, DNS changes or paid services.
- Workers Cache purge is subject to Cloudflare Free-tier limits (the API reports failure if rate-limited). Purge failure does not grant access to stale bytes because authorization is performed before each cache read.
- Cache TTL is 60 seconds for performance and storage hygiene, not as a security revocation guarantee.
- The exact subscribed Cloudflare plan still needs independent confirmation if Billing Read permission is unavailable.
- Existing large images are not converted by this change. New uploads retain the existing optimization behavior; original Drive files are not modified.

## Manual secret setup required before rollout

The connected Supabase integration does not expose the secure Edge Function secret-collection flow for this project. The project owner must create one random secret (at least 32 random bytes) in a password manager and enter it directly in the two dashboards. Never send the value in chat, commit it, or place it in a workflow file.

1. Supabase Dashboard → project `yycfqeymdsjyulexwrlb` → Edge Functions → Secrets. Add Key `RKC_CACHE_PURGE_SECRET` and the generated Value, then Save. Supabase applies new Edge Function secrets immediately; no function redeploy is required.
2. Keep the same value securely for the Cloudflare step. Do not deploy a new production Worker yet.
3. Only after the production `drive-media` probe returns 204 + `Cache-Control: no-store`, open Cloudflare Dashboard → Workers & Pages → `rkc-public-materias-cache` → Settings → Variables and Secrets → Add → Type **Secret** → name `RKC_CACHE_PURGE_SECRET` → paste the same value → Deploy. This deployment step is deliberately deferred until the compatibility gate passes.

## Rollout and rollback

- Deploy the Worker and updated drive-media Edge Function only after automated checks, staging HTTPS tests and security checks pass.
- Rollback by restoring the previous Worker version and previous drive-media Edge Function version. Keep the previous deployment identifiers before rollout.
- The current production Edge Function v30 is not compatible with the authorization-only probe contract. Deploy the tested `drive-media` update first, verify 204 + no-store against real public media, then deploy the Worker. The production baseline remains Worker version 4 and Edge Function version 30; restore these if a controlled rollout fails. The production Worker must receive `RKC_CACHE_PURGE_SECRET` as a secret binding before the bridge is enabled.
