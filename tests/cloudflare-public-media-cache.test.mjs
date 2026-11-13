import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/workers/rkc-public-materias-cache/worker.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test-key" };

test("public JPEG, PNG and WebP responses are cacheable and tagged", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
      globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": contentType } });
      const response = await worker.fetch(new Request("https://worker.example/media?id=projetos-abc"), env, {});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "public, max-age=0, s-maxage=60");
      assert.equal(response.headers.get("Cache-Tag"), "rkc-public-media,media-projetos-abc");
      assert.equal(response.headers.get("X-RKC-Media-Origin"), "drive-media");
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("private or unrecognized media is rejected by the origin and never cached", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-private-test"), env, {});
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Cache-Tag"), null);
  } finally { globalThis.fetch = originalFetch; }
});

test("invalid slug is rejected before origin access", async () => {
  const originalFetch = globalThis.fetch;
  let originCalls = 0;
  globalThis.fetch = async () => { originCalls++; throw new Error("must not fetch"); };
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=private-file-123"), env, {});
    assert.equal(response.status, 404);
    assert.equal(originCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("Range is left to Workers Cache and the origin receives a full GET", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(init.headers, undefined);
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg" } });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-abc", { headers: { Range: "bytes=0-1" } }), env, {});
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /s-maxage=60/);
  } finally { globalThis.fetch = originalFetch; }
});

test("non-image and non-200 responses are never cacheable", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("not an image", { status: 200, headers: { "Content-Type": "text/plain" } });
    let response = await worker.fetch(new Request("https://worker.example/media?id=materia-abc"), env, {});
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    globalThis.fetch = async () => new Response("not found", { status: 404, headers: { "Content-Type": "image/jpeg" } });
    response = await worker.fetch(new Request("https://worker.example/media?id=materia-abc"), env, {});
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally { globalThis.fetch = originalFetch; }
});

test("public article list carries a purge tag and rewrites only known public media URLs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: "1", slug: "news", titulo: "Teste", status: "published",
    capa_url: "https://project.supabase.co/functions/v1/drive-media?id=materia-abc",
    banner_url: "https://project.supabase.co/functions/v1/drive-media?id=private-123",
    capa_thumb_url: "https://cdn.example/photo.jpg",
  }]), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const response = await worker.fetch(new Request("https://worker.example/materias"), { ...env }, {});
    assert.equal(response.headers.get("Cache-Tag"), "rkc-public-materias");
    const [row] = await response.json();
    assert.equal(row.capa_url, "https://worker.example/media?id=materia-abc");
    assert.equal(row.banner_url, "https://project.supabase.co/functions/v1/drive-media?id=private-123");
    assert.equal(row.capa_thumb_url, "https://cdn.example/photo.jpg");
  } finally { globalThis.fetch = originalFetch; }
});

test("cache purge rejects missing or wrong secret", async () => {
  const originalFetch = globalThis.fetch;
  let purges = 0;
  globalThis.fetch = async () => { throw new Error("not used"); };
  try {
    const response = await worker.fetch(new Request("https://worker.example/__cache/purge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["rkc-public-media"] }) }), { ...env, RKC_CACHE_PURGE_SECRET: "expected-secret" }, { cache: { purge: async () => { purges++; return { success: true }; } } });
    assert.equal(response.status, 401);
    assert.equal(purges, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("cache purge validates tags and calls Workers Cache purge", async () => {
  const originalFetch = globalThis.fetch;
  let purgedTags = null;
  const ctx = { cache: { purge: async ({ tags }) => { purgedTags = tags; return { success: true }; } } };
  try {
    const invalid = await worker.fetch(new Request("https://worker.example/__cache/purge", { method: "POST", headers: { Authorization: "Bearer expected-secret", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["*"] }) }), { ...env, RKC_CACHE_PURGE_SECRET: "expected-secret" }, ctx);
    assert.equal(invalid.status, 400);
    assert.equal(purgedTags, null);

    const valid = await worker.fetch(new Request("https://worker.example/__cache/purge", { method: "POST", headers: { Authorization: "Bearer expected-secret", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["rkc-public-materias", "rkc-public-media", "media-materia-abc"] }) }), { ...env, RKC_CACHE_PURGE_SECRET: "expected-secret" }, ctx);
    assert.equal(valid.status, 200);
    assert.deepEqual(purgedTags, ["rkc-public-materias", "rkc-public-media", "media-materia-abc"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("HEAD is supported without storing a separate empty response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.method, "GET");
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg" } });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-abc", { method: "HEAD" }), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(await response.text(), "");
  } finally { globalThis.fetch = originalFetch; }
});

test("cache purge reports a failure when Cloudflare does not confirm purge", async () => {
  const response = await worker.fetch(new Request("https://worker.example/__cache/purge", {
    method: "POST",
    headers: { Authorization: "Bearer expected-secret", "Content-Type": "application/json" },
    body: JSON.stringify({ tags: ["rkc-public-media"] }),
  }), { ...env, RKC_CACHE_PURGE_SECRET: "expected-secret" }, {
    cache: { purge: async () => ({ success: false, errors: [{ code: 1 }] }) },
  });
  assert.equal(response.status, 502);
});
