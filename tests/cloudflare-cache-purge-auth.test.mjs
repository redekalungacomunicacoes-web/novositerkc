import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const state = { user: true, allowed: true, configured: true, calls: [] };
globalThis.__rkcPurgeTest = {
  state,
  createClient: () => ({
    auth: { getUser: async () => state.user ? { data: { user: { id: "editor-id" } }, error: null } : { data: { user: null }, error: new Error("invalid token") } },
    rpc: async () => ({ data: state.allowed, error: null }),
  }),
};
let handler;
globalThis.Deno = {
  env: { get(name) {
    if (name === "SUPABASE_URL") return "https://project.supabase.co";
    if (name === "SUPABASE_ANON_KEY") return "test-anon-key";
    if (name === "RKC_CACHE_PURGE_SECRET") return state.configured ? "test-purge-secret" : undefined;
    return undefined;
  } },
  serve(fn) { handler = fn; },
};
let source = await readFile("supabase/functions/cloudflare-cache-purge/index.ts", "utf8");
source = source.replace(
  'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
  "const { createClient } = globalThis.__rkcPurgeTest;",
);
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
assert.equal(typeof handler, "function");

test("purge bridge requires a JWT", async () => {
  const response = await handler(new Request("https://project.supabase.co/functions/v1/cloudflare-cache-purge", { method: "POST" }));
  assert.equal(response.status, 401);
});

test("purge bridge denies invalid users and non-editor roles", async () => {
  state.user = false;
  let response = await handler(new Request("https://project.supabase.co/functions/v1/cloudflare-cache-purge", { method: "POST", headers: { Authorization: "Bearer invalid" } }));
  assert.equal(response.status, 401);
  state.user = true;
  state.allowed = false;
  response = await handler(new Request("https://project.supabase.co/functions/v1/cloudflare-cache-purge", { method: "POST", headers: { Authorization: "Bearer valid" } }));
  assert.equal(response.status, 403);
  state.allowed = true;
});

test("purge bridge refuses to operate without the shared secret", async () => {
  state.configured = false;
  const response = await handler(new Request("https://project.supabase.co/functions/v1/cloudflare-cache-purge", { method: "POST", headers: { Authorization: "Bearer valid" } }));
  assert.equal(response.status, 503);
  state.configured = true;
});

test("authorized editor requests only the two fixed global tags", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    state.calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ purged: ["rkc-public-materias", "rkc-public-media"] }), { status: 200 });
  };
  try {
    const response = await handler(new Request("https://project.supabase.co/functions/v1/cloudflare-cache-purge", { method: "POST", headers: { Authorization: "Bearer valid" } }));
    assert.equal(response.status, 200);
    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0].url, "https://rkc-public-materias-cache.redekalungacomunicacoes.workers.dev/__cache/purge");
    assert.equal(state.calls[0].init.method, "POST");
    assert.equal(state.calls[0].init.headers.Authorization, "Bearer test-purge-secret");
    assert.deepEqual(JSON.parse(state.calls[0].init.body).tags, ["rkc-public-materias", "rkc-public-media"]);
  } finally { globalThis.fetch = originalFetch; }
});
