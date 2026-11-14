import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/workers/rkc-public-materias-cache/worker.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test-key" };

test("JPEG, PNG and WebP use an authorized cacheable origin subrequest", async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      let driveOriginGets = 0;
      let cachedBody = null;
      globalThis.fetch = async (_url, init) => {
        if (init.method === "HEAD") {
          assert.equal(init.cf.cacheTtl, 0);
          return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
        }
        assert.equal(init.cf.cacheEverything, true);
        assert.equal(init.cf.cacheTtl, 60);
        assert.deepEqual(init.cf.cacheTags, ["rkc-public-media", "media-materia-image"]);
        if (cachedBody) return new Response(cachedBody, { status: 200, headers: { "Content-Type": type, "CF-Cache-Status": "HIT" } });
        driveOriginGets++;
        cachedBody = new Uint8Array([1, 2, 3]);
        return new Response(cachedBody, { status: 200, headers: { "Content-Type": type, "CF-Cache-Status": "MISS" } });
      };
      const first = await worker.fetch(new Request("https://worker.example/media?id=materia-image"), env, {});
      assert.equal(first.status, 200);
      assert.equal(first.headers.get("X-RKC-Media-Cache"), "MISS");
      assert.equal(first.headers.get("Cache-Control"), "no-store");
      const second = await worker.fetch(new Request("https://worker.example/media?id=materia-image"), env, {});
      assert.equal(second.status, 200);
      assert.equal(second.headers.get("X-RKC-Media-Cache"), "HIT");
      assert.equal(driveOriginGets, 1, "only one image transfer should reach the origin");
    }
  } finally { globalThis.fetch = oldFetch; }
});

test("revocation blocks stale cached bytes immediately even when purge fails", async () => {
  const oldFetch = globalThis.fetch;
  let revoked = false;
  let originGets = 0;
  globalThis.fetch = async (_url, init) => {
    if (init.method === "HEAD") {
      return revoked
        ? new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } })
        : new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    originGets++;
    return new Response("cached image", { status: 200, headers: { "Content-Type": "image/jpeg", "CF-Cache-Status": "MISS" } });
  };
  try {
    const first = await worker.fetch(new Request("https://worker.example/media?id=materia-revoked"), env, {});
    assert.equal(first.status, 200);
    assert.equal(originGets, 1);

    revoked = true;
    const purge = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST",
      headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["media-materia-revoked"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, {
      cache: { purge: async () => ({ success: false, errors: [{ code: 1, message: "simulated failure" }] }) },
    });
    assert.equal(purge.status, 502);

    const afterRevocation = await worker.fetch(new Request("https://worker.example/media?id=materia-revoked"), env, {});
    assert.equal(afterRevocation.status, 404);
    assert.equal(afterRevocation.headers.get("Cache-Control"), "no-store");
    assert.equal(originGets, 1, "stale cached image must not be requested after failed authorization");
  } finally { globalThis.fetch = oldFetch; }
});

test("authorization outage fails closed instead of using a cached origin response", async () => {
  const oldFetch = globalThis.fetch;
  let originGets = 0;
  globalThis.fetch = async (_url, init) => {
    if (init.method === "HEAD") throw new Error("origin unavailable");
    originGets++;
    return new Response("must not be reached", { status: 200, headers: { "Content-Type": "image/jpeg" } });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-outage"), env, {});
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(originGets, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test("private or unknown media is rejected before the cacheable GET", async () => {
  const oldFetch = globalThis.fetch;
  let gets = 0;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.method, "HEAD");
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-private"), env, {});
    assert.equal(response.status, 404);
    assert.equal(gets, 0);
  } finally { globalThis.fetch = oldFetch; }
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

test("purge endpoint authenticates, validates tags and reports Cloudflare failures", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("not used"); };
  try {
    const unauthorized = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["media-materia-abc"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, { cache: { purge: async () => ({ success: true }) } });
    assert.equal(unauthorized.status, 401);
    const invalid = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["*"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, { cache: { purge: async () => ({ success: true }) } });
    assert.equal(invalid.status, 400);
    const failed = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["media-materia-abc"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, { cache: { purge: async () => ({ success: false, errors: [{ code: 1 }] }) } });
    assert.equal(failed.status, 502);
    let purged = null;
    const success = await worker.fetch(new Request("https://worker.example/__cache/purge", {
      method: "POST", headers: { Authorization: "Bearer secret", "Content-Type": "application/json" }, body: JSON.stringify({ tags: ["rkc-public-media", "media-materia-abc"] }),
    }), { ...env, RKC_CACHE_PURGE_SECRET: "secret" }, { cache: { purge: async ({ tags }) => { purged = tags; return { success: true }; } } });
    assert.equal(success.status, 200);
    assert.deepEqual(purged, ["rkc-public-media", "media-materia-abc"]);
  } finally { globalThis.fetch = oldFetch; }
});

test("legacy authorized HEAD response remains compatible during staged rollout", async () => {
  const oldFetch = globalThis.fetch;
  let imageGets = 0;
  globalThis.fetch = async (_url, init) => {
    if (init.method === "HEAD") {
      return new Response(null, { status: 200, headers: { "Cache-Control": "public, max-age=0, s-maxage=0, must-revalidate" } });
    }
    imageGets++;
    return new Response(new Uint8Array([4, 5, 6]), { status: 200, headers: { "Content-Type": "image/jpeg", "CF-Cache-Status": "MISS" } });
  };
  try {
    const response = await worker.fetch(new Request("https://worker.example/media?id=materia-legacy"), env, {});
    assert.equal(response.status, 200);
    assert.equal(imageGets, 1);
  } finally { globalThis.fetch = oldFetch; }
});
