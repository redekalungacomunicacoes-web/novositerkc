import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheProjectShareImage, renderProjectSeo } from "../scripts/generate-article-seo.mjs";

test("public project social HTML contains dedicated title, description, canonical and image", () => {
  const html = renderProjectSeo("<html><head><title>Site</title></head><body></body></html>", {
    slug: "kalucast", titulo: "KaluCast - A Voz e as Narrativas do maior Quilombo do Brasil",
    resumo: "", descricao: "Comunicação e memória do território Kalunga",
    image: "https://kalungacomunicacoes.org/social/projetos/kalucast.jpg",
  });
  assert.match(html, /property="og:title" content="KaluCast - A Voz/);
  assert.match(html, /property="og:description" content="Comunicação e memória/);
  assert.match(html, /property="og:image" content="https:\/\/kalungacomunicacoes.org\/social\/projetos\/kalucast.jpg"/);
  assert.match(html, /property="og:image:secure_url"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /rel="canonical" href="https:\/\/kalungacomunicacoes.org\/projetos\/kalucast"/);
});

test("caches public images for social crawlers, rejects non-images", async () => {
  const original = globalThis.fetch;
  const root = await mkdtemp(join(tmpdir(), "rkc-og-"));
  try {
    globalThis.fetch = async () => new Response(new Uint8Array(200).fill(1), { headers: { "content-type": "image/jpeg" } });
    const url = await cacheProjectShareImage({ slug: "kalucast" }, "https://example.org/cover.jpg", root);
    assert.equal(url, "https://kalungacomunicacoes.org/social/projetos/kalucast.jpg");
    assert.equal((await readFile(join(root, "social/projetos/kalucast.jpg"))).length, 200);
    globalThis.fetch = async () => new Response("<html>Unauthorized</html>", { headers: { "content-type": "text/html" } });
    assert.equal(await cacheProjectShareImage({ slug: "kalucast" }, "https://example.org/cover.jpg", root), "");
  } finally {
    globalThis.fetch = original;
    await rm(root, { recursive: true, force: true });
  }
});
