import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/workers/rkc-public-materias-cache/worker.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test-key" };

function installCache() {
  const entries = new Map();
  globalThis.caches = { default: {
    async match(key) { return entries.get(key.url)?.clone(); },
    async put(key, response) { entries.set(key.url, response.clone()); },
    async delete(key) { return entries.delete(key.url); },
  }};
  return entries;
}

test("JPEG, PNG and WebP are cached after a fresh authorization probe", async () => {
  const oldFetch = globalThis.fetch;
  const oldCaches = globalThis.caches;
  const entries = installCache();
  try {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      let originGets = 0;
      globalThis.fetch = async (_url, init) => {
        if (init.method === "HEAD") return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
        originGets++;
        return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": type } });
      };
      const first = await worker.fetch(new Request("https://worker.example/media?id=materia-abc"), env, {});
      assert.equal(first.status, 200);
      assert.equal(first.headers.get("X-RKC-Media-Cache"), "MISS");
      const second = await worker.fetch(new Request("https://worker.example/media?id=materia-abc"), env, {});
      assert.equal(second.status, 200);
      assert.equal(second.headers.get("X-RKC-Media-Cache"), "HIT");
      assert.equal(originGets, 1, "one Drive-origin GET for two authorized requests");
      assert.equal(entries.size, 1);
      entries.clear();
    }
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCaches === undefined) delete globalThis.caches; else globalThis.caches = oldCaches;
  }
});

test("revocation blocks cached bytes immediately even when cache deletion fails", async () => {
  const oldFetch = globalThis.fetch;
  const oldCaches = globalThis.caches;
  const entries = installCache();
  try {
    globalThis.fetch = async (_url, init) => init.method === "HEAD"
      ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })
      : new Response("sensitive image", { status: 200, headers: { "Content-Type": "image/jpeg" } });
    const first = await worker.fetch(new Request("https://worker.example/media?id=materia-revoked"), env, {});
    assert.equal(first.status, 200);
    assert.equal(entries.size, 1);

    // Simulate an unpublish/removal at the authoritative origin and a failed purge.
    globalThis.caches.default.delete = async () => { throw new Error("purge unavailable"); };
    const purge = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST",
      headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["media-materia-revoked"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, {});
    assert.equal(purge.status, 502);

    globalThis.fetch = async (_url, init) => {
      assert.equal(init.method, "HEAD");
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    };
    const afterRevocation = await worker.fetch(new Request("https://worker.example/media?id=materia-revoked"), env, {});
    assert.equal(afterRevocation.status, 404);
    assert.equal(afterRevocation.headers.get("Cache-Control"), "no-store");
    assert.equal(entries.size, 1, "stale bytes may remain physically cached but are never served");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCaches === undefined) delete globalThis.caches; else globalThis.caches = oldCaches;
  }
});

test("authorization outage fails closed and does not fall back to cached bytes", async () => {
  const oldFetch = globalThis.fetch;
  const oldCaches = globalThis.caches;
  const entries = installCache();
  try {
    const key = new Request("https://worker.example/__rkc_media_cache?id=materia-outage");
    entries.set(key.url, new Response("cached bytes", { status: 200, headers: { "Content-Type": "image/jpeg" } }));
    globalThis.fetch = async () => { throw new Error("origin unavailable"); };
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-outage"), env, {});
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCaches === undefined) delete globalThis.caches; else globalThis.caches = oldCaches;
  }
});

test("private and unknown media are rejected before cache lookup", async () => {
  const oldFetch = globalThis.fetch;
  const oldCaches = globalThis.caches;
  let lookups = 0;
  globalThis.caches = { default: { async match() { lookups++; return null; } } };
  globalThis.fetch = async () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-private"), env, {});
    assert.equal(response.status, 404);
    assert.equal(lookups, 0);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldCaches === undefined) delete globalThis.caches; else globalThis.caches = oldCaches;
  }
});

test("invalid media identifiers never reach the origin", async () => {
  const oldFetch = globalThis.fetch;
  let originCalls = 0;
  globalThis.fetch = async () => { originCalls++; throw new Error("unexpected"); };
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=private-file-123"), env, {});
    assert.equal(response.status, 404);
    assert.equal(originCalls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test("purge endpoint requires the secret and validates media tags", async () => {
  const oldCaches = globalThis.caches;
  let deleted = 0;
  globalThis.caches = { default: { async delete() { deleted++; return true; } } };
  try {
    const unauthorized = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["media-materia-abc"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, {});
    assert.equal(unauthorized.status, 401);
    const invalid = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["*"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, {});
    assert.equal(invalid.status, 400);
    const valid = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["media-materia-abc"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, {});
    assert.equal(valid.status, 200);
    assert.equal(deleted, 1);
  } finally {
    if (oldCaches === undefined) delete globalThis.caches; else globalThis.caches = oldCaches;
  }
});
