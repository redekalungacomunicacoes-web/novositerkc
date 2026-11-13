import test from "node:test";
import assert from "node:assert/strict";
import worker, { mediaCacheKey, servePublicMedia } from "../cloudflare/workers/rkc-public-materias-cache/worker.mjs";

function makeCache() {
  const store = new Map();
  return {
    store,
    default: {
      async match(key) { const value = store.get(key.url); return value?.clone() ?? undefined; },
      async put(key, value) { store.set(key.url, value.clone()); },
    },
  };
}

test("media cache key is isolated by public media slug", () => {
  assert.match(mediaCacheKey("https://worker.example", "materia-abc").url, /materia-abc$/);
  assert.notEqual(
    mediaCacheKey("https://worker.example", "materia-abc").url,
    mediaCacheKey("https://worker.example", "materia-def").url,
  );
});

test("first public JPEG request is MISS and second request is HIT without origin fetch", async () => {
  const cache = makeCache();
  globalThis.caches = cache;
  let originCalls = 0;
  globalThis.fetch = async () => {
    originCalls++;
    return new Response(new Uint8Array([255, 216, 255]), {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "Content-Length": "3" },
    });
  };
  const env = { SUPABASE_URL: "https://project.supabase.co" };
  const ctx = { waitUntil(promise) { this.pending = promise; } };
  const url = new URL("https://worker.example/media?id=materia-abc");

  const first = await servePublicMedia(new Request(url), url, env, ctx);
  await ctx.pending;
  assert.equal(first.headers.get("X-RKC-Media-Cache"), "MISS");
  assert.equal(first.headers.get("Cache-Control"), "public, max-age=60, s-maxage=60");

  const second = await servePublicMedia(new Request(url), url, env, ctx);
  assert.equal(second.headers.get("X-RKC-Media-Cache"), "HIT");
  assert.equal(originCalls, 1);
});

test("unknown media slugs are rejected before origin access", async () => {
  let originCalls = 0;
  globalThis.caches = makeCache();
  globalThis.fetch = async () => { originCalls++; throw new Error("must not fetch"); };
  const url = new URL("https://worker.example/media?id=private-file-123");
  const response = await servePublicMedia(new Request(url), url, { SUPABASE_URL: "https://project.supabase.co" }, { waitUntil() {} });
  assert.equal(response.status, 404);
  assert.equal(originCalls, 0);
});

test("non-image responses and range requests are never cached", async () => {
  const cache = makeCache();
  globalThis.caches = cache;
  globalThis.fetch = async () => new Response("not an image", { status: 200, headers: { "Content-Type": "text/plain" } });
  const url = new URL("https://worker.example/media?id=materia-abc");
  const ctx = { waitUntil(promise) { this.pending = promise; } };
  const response = await servePublicMedia(new Request(url), url, { SUPABASE_URL: "https://project.supabase.co" }, ctx);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(cache.store.size, 0);

  const rangeResponse = await servePublicMedia(new Request(url, { headers: { Range: "bytes=0-1" } }), url, { SUPABASE_URL: "https://project.supabase.co" }, ctx);
  assert.equal(rangeResponse.headers.get("Cache-Control"), "no-store");
  assert.equal(cache.store.size, 0);
});

test("public media URL rewrite leaves private and unrelated URLs unchanged", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.caches = makeCache();
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: "1", slug: "news", titulo: "Teste", status: "published",
    capa_url: "https://project.supabase.co/functions/v1/drive-media?id=materia-abc",
    banner_url: "https://project.supabase.co/functions/v1/drive-media?id=private-123",
    capa_thumb_url: "https://cdn.example/photo.jpg",
  }]), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const response = await worker.fetch(
      new Request("https://worker.example/materias"),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test-key" },
      { waitUntil() {} },
    );
    const [row] = await response.json();
    assert.equal(row.capa_url, "https://worker.example/media?id=materia-abc");
    assert.equal(row.banner_url, "https://project.supabase.co/functions/v1/drive-media?id=private-123");
    assert.equal(row.capa_thumb_url, "https://cdn.example/photo.jpg");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
