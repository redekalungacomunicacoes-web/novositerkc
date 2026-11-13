import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/workers/rkc-public-materias-cache/worker.mjs";

test("public JPEG, PNG and WebP responses are eligible for shared edge caching", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
      globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": contentType } });
      const response = await worker.fetch(new Request("https://worker.example/media?id=projetos-abc"), { SUPABASE_URL: "https://project.supabase.co" }, {});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "public, max-age=60, s-maxage=60");
      assert.equal(response.headers.get("X-RKC-Media-Origin"), "drive-media");
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("private or unknown media is rejected by the origin and never cached", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=private-file-123"), { SUPABASE_URL: "https://project.supabase.co" }, {});
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally { globalThis.fetch = originalFetch; }
});

test("non-image, non-200 and Range responses are never cacheable", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("not an image", { status: 200, headers: { "Content-Type": "text/plain" } });
    let response = await worker.fetch(new Request("https://worker.example/media?id=projetos-abc"), { SUPABASE_URL: "https://project.supabase.co" }, {});
    assert.equal(response.headers.get("Cache-Control"), "no-store");

    globalThis.fetch = async () => new Response("not found", { status: 404, headers: { "Content-Type": "image/jpeg" } });
    response = await worker.fetch(new Request("https://worker.example/media?id=materia-abc"), { SUPABASE_URL: "https://project.supabase.co" }, {});
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Cache-Control"), "no-store");

    globalThis.fetch = async (_url, init) => {
      assert.equal(init.headers.get("Range"), "bytes=0-1");
      return new Response(new Uint8Array([1, 2]), { status: 206, headers: { "Content-Type": "image/jpeg", "Content-Range": "bytes 0-1/3" } });
    };
    response = await worker.fetch(new Request("https://worker.example/media?id=materia-abc", { headers: { Range: "bytes=0-1" } }), { SUPABASE_URL: "https://project.supabase.co" }, {});
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally { globalThis.fetch = originalFetch; }
});

test("public cover URL is rewritten while private and unrelated URLs remain unchanged", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{
    id: "1", slug: "news", titulo: "Teste", status: "published",
    capa_url: "https://project.supabase.co/functions/v1/drive-media?id=materia-abc",
    banner_url: "https://project.supabase.co/functions/v1/drive-media?id=private-123",
    capa_thumb_url: "https://cdn.example/photo.jpg",
  }]), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const response = await worker.fetch(new Request("https://worker.example/materias"), { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test-key" }, {});
    const [row] = await response.json();
    assert.equal(row.capa_url, "https://worker.example/media?id=materia-abc");
    assert.equal(row.banner_url, "https://project.supabase.co/functions/v1/drive-media?id=private-123");
    assert.equal(row.capa_thumb_url, "https://cdn.example/photo.jpg");
  } finally { globalThis.fetch = originalFetch; }
});
