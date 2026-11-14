import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class TestWorkerEntrypoint {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
globalThis.__rkcTest = { WorkerEntrypoint: TestWorkerEntrypoint };
let source = await readFile("cloudflare/workers/rkc-public-materias-cache/worker.mjs", "utf8");
source = source.replace(
  'import { WorkerEntrypoint } from "cloudflare:workers";',
  "const { WorkerEntrypoint } = globalThis.__rkcTest;",
);
const moduleUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const { default: worker, MediaCache } = await import(moduleUrl);

const env = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  RKC_CACHE_PURGE_SECRET: "secret",
};

function makeHarness({ mimeType = "image/jpeg", authStatus = 204, purgeSuccess = true } = {}) {
  let revoked = false;
  let authCalls = 0;
  let originGets = 0;
  let purgeCalls = 0;
  let purgeShouldSucceed = purgeSuccess;
  const entries = new Map();
  const cacheContext = {
    async purge({ tags }) {
      purgeCalls++;
      if (!purgeShouldSucceed) return { success: false, errors: [{ code: 1, message: "simulated purge failure" }] };
      for (const [key, entry] of entries) {
        if (entry.tags.some((tag) => tags.includes(tag))) entries.delete(key);
      }
      return { success: true, errors: [] };
    },
  };
  const mediaCache = new MediaCache({ cache: cacheContext }, env);
  const exports = {
    MediaCache: {
      async fetch(request) {
        const key = request.url;
        const cached = entries.get(key);
        if (cached) {
          return new Response(cached.body.slice(0), {
            status: cached.status,
            headers: { ...cached.headers, "CF-Cache-Status": "HIT" },
          });
        }
        const response = await mediaCache.fetch(request);
        const cacheControl = response.headers.get("Cache-Control") || "";
        if (response.status === 200 && cacheControl.includes("max-age=") && !cacheControl.includes("no-store")) {
          const body = await response.arrayBuffer();
          const headers = Object.fromEntries(response.headers);
          const tags = (response.headers.get("Cache-Tag") || "").split(",").filter(Boolean);
          entries.set(key, { body, headers, status: response.status, tags });
          return new Response(body.slice(0), { status: response.status, headers: { ...headers, "CF-Cache-Status": "MISS" } });
        }
        return response;
      },
      purge(tags) {
        return mediaCache.purge(tags);
      },
    },
  };
  const ctx = { exports, cache: cacheContext };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.searchParams.get("authorize") === "1") {
      authCalls++;
      assert.equal(init.method, "GET");
      assert.equal(init.headers.Range, "bytes=0-0");
      if (revoked) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
      if (authStatus === 206) {
        return new Response(new Uint8Array([1]), {
          status: 206,
          headers: {
            "Cache-Control": "public, max-age=0, s-maxage=0, must-revalidate",
            "Content-Type": mimeType,
            "Content-Range": "bytes 0-0/3000",
          },
        });
      }
      if (authStatus === "throw") throw new Error("authorization service unavailable");
      return new Response(null, { status: authStatus, headers: { "Cache-Control": authStatus === 204 ? "no-store" : "no-store" } });
    }
    originGets++;
    return new Response(new Uint8Array([0, 1, 2, 3, 4]), {
      status: 200,
      headers: { "Content-Type": mimeType, "Content-Length": "5" },
    });
  };

  return {
    ctx,
    entries,
    get authCalls() { return authCalls; },
    get originGets() { return originGets; },
    get purgeCalls() { return purgeCalls; },
    setRevoked(value) { revoked = value; },
    setPurgeSuccess(value) { purgeShouldSucceed = value; },
    async fetchMedia(id = "materia-image", requestInit = {}) {
      return worker.fetch(new Request(`https://worker.example/media?id=${id}`, requestInit), env, ctx);
    },
    async purge(tags = ["media-materia-image"], token = "secret") {
      return worker.fetch(new Request("https://worker.example/__cache/purge", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      }), env, ctx);
    },
    restoreFetch() { globalThis.fetch = oldFetch; },
  };
}

test("JPEG, PNG and WebP use a separate cacheable entrypoint after authorization", async () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    const h = makeHarness({ mimeType });
    try {
      const first = await h.fetchMedia();
      assert.equal(first.status, 200);
      assert.equal(first.headers.get("X-RKC-Media-Cache"), "MISS");
      assert.equal(first.headers.get("Cache-Control"), "no-store");
      const second = await h.fetchMedia();
      assert.equal(second.status, 200);
      assert.equal(second.headers.get("X-RKC-Media-Cache"), "HIT");
      assert.equal(h.authCalls, 2, "authorization is checked on every request");
      assert.equal(h.originGets, 1, "only the first cache miss transfers image bytes from drive-media");
      assert.equal(h.entries.size, 1);
    } finally { h.restoreFetch(); }
  }
});

test("revocation blocks stale cached bytes immediately even when cache purge fails", async () => {
  const h = makeHarness();
  try {
    assert.equal((await h.fetchMedia("materia-revoked")).status, 200);
    assert.equal(h.originGets, 1);
    h.setRevoked(true);
    h.setPurgeSuccess(false);
    const purge = await h.purge(["media-materia-revoked"]);
    assert.equal(purge.status, 502);
    const afterRevocation = await h.fetchMedia("materia-revoked");
    assert.equal(afterRevocation.status, 404);
    assert.equal(afterRevocation.headers.get("Cache-Control"), "no-store");
    assert.equal(h.originGets, 1, "the cached entrypoint is never called after failed authorization");
    assert.equal(h.entries.size, 1, "stale bytes may remain cached but are not accessible");
  } finally { h.restoreFetch(); }
});

test("authorization outage fails closed instead of entering the cached entrypoint", async () => {
  const h = makeHarness({ authStatus: "throw" });
  try {
    const response = await h.fetchMedia("materia-outage");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(h.originGets, 0);
  } finally { h.restoreFetch(); }
});

test("private or unknown media is rejected before the cacheable entrypoint", async () => {
  const h = makeHarness({ authStatus: 404 });
  try {
    const response = await h.fetchMedia("materia-private");
    assert.equal(response.status, 404);
    assert.equal(h.originGets, 0);
  } finally { h.restoreFetch(); }
});

test("invalid media identifiers never reach authorization or image delivery", async () => {
  const h = makeHarness();
  try {
    const response = await h.fetchMedia("private-file-123");
    assert.equal(response.status, 404);
    assert.equal(h.authCalls, 0);
    assert.equal(h.originGets, 0);
  } finally { h.restoreFetch(); }
});

test("purge endpoint authenticates, validates tags and purges the MediaCache entrypoint", async () => {
  const h = makeHarness();
  try {
    const unauthorized = await h.purge(["media-materia-image"], "wrong");
    assert.equal(unauthorized.status, 401);
    const invalid = await h.purge(["*"]);
    assert.equal(invalid.status, 400);
    assert.equal((await h.fetchMedia()).status, 200);
    assert.equal(h.entries.size, 1);
    const success = await h.purge(["rkc-public-media", "media-materia-image"]);
    assert.equal(success.status, 200);
    assert.equal(h.purgeCalls, 1);
    assert.equal(h.entries.size, 0);
    assert.equal((await h.fetchMedia()).headers.get("X-RKC-Media-Cache"), "MISS");
    assert.equal(h.originGets, 2);
  } finally { h.restoreFetch(); }
});

test("legacy one-byte Range authorization response remains compatible during staged rollout", async () => {
  const h = makeHarness({ authStatus: 206 });
  try {
    const response = await h.fetchMedia("materia-legacy");
    assert.equal(response.status, 200);
    assert.equal(h.authCalls, 1);
    assert.equal(h.originGets, 1);
  } finally { h.restoreFetch(); }
});

test("Range requests are sliced from the full cached object", async () => {
  const h = makeHarness();
  try {
    const response = await h.fetchMedia("materia-range", { headers: { Range: "bytes=1-3" } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("Content-Range"), "bytes 1-3/5");
    assert.equal(response.headers.get("Content-Length"), "3");
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
    assert.equal(h.originGets, 1);
  } finally { h.restoreFetch(); }
});
