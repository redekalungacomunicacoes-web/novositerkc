import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const state = {
  visibility: "public",
  fileStatus: "active",
  deleted: false,
  articleStatus: "published",
  linked: true,
  googleDownloads: 0,
};
globalThis.__rkcTest = {
  state,
  createClient: () => ({
    from(table) {
      const filters = {};
      const query = {
        select() { return query; },
        eq(column, value) { filters[column] = value; return query; },
        is(column, value) { filters[column] = value; return query; },
        async single() {
          if (table !== "drive_files") return { data: null, error: new Error("unexpected table") };
          const ok = state.visibility === "public" && state.fileStatus === "active" && !state.deleted;
          return ok ? { data: {
            id: "metadata-id",
            drive_file_id: "physical-drive-id",
            name: "photo.jpg",
            mime_type: "image/jpeg",
            size_bytes: 3,
            module: "materias",
            entity_id: "article-id",
            category: "content",
          }, error: null } : { data: null, error: new Error("not found") };
        },
        async maybeSingle() {
          if (table !== "materias") return { data: null, error: new Error("unexpected table") };
          if (state.articleStatus !== "published") return { data: null, error: null };
          return { data: {
            id: "article-id",
            status: "published",
            capa_drive_file_id: null,
            capa_thumb_drive_file_id: null,
            banner_drive_file_id: null,
            audio_drive_file_id: null,
            content_blocks: state.linked ? [{ drive_file_id: "metadata-id" }] : [],
          }, error: null };
        },
      };
      return query;
    },
  }),
};
let handler;
globalThis.Deno = {
  env: { get(name) {
    return ({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
      GOOGLE_OAUTH_CLIENT_ID: "test-client",
      GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
      GOOGLE_OAUTH_REFRESH_TOKEN: "test-refresh",
    })[name] || undefined;
  } },
  serve(fn) { handler = fn; },
};

let source = await readFile("supabase/functions/drive-media/index.ts", "utf8");
source = source.replace(
  'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
  "const { createClient } = globalThis.__rkcTest;",
);
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
assert.equal(typeof handler, "function");

test("same media slug is revalidated after the article is unpublished", async () => {
  const originalFetch = globalThis.fetch;
  let downloads = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).includes("googleapis.com/drive/v3/files/")) {
      downloads++;
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg", "Content-Length": "3" } });
    }
    throw new Error("unexpected fetch " + url);
  };
  try {
    Object.assign(state, { visibility: "public", fileStatus: "active", deleted: false, articleStatus: "published", linked: true });
    const first = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-test"));
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Cache-Control"), "public, max-age=0, s-maxage=0, must-revalidate");

    state.articleStatus = "draft";
    const second = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-test"));
    assert.equal(second.status, 404);
    assert.equal(downloads, 1, "unpublished media must not trigger another Drive download");
  } finally { globalThis.fetch = originalFetch; }
});

test("private, archived and deleted media are denied before downloading from Drive", async () => {
  const originalFetch = globalThis.fetch;
  let downloads = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }), { status: 200 });
    if (String(url).includes("googleapis.com/drive/v3/files/")) { downloads++; return new Response(new Uint8Array([1, 2, 3]), { status: 200 }); }
    throw new Error("unexpected fetch " + url);
  };
  try {
    for (const patch of [
      { visibility: "private", fileStatus: "active", deleted: false, articleStatus: "published", linked: true },
      { visibility: "public", fileStatus: "archived", deleted: false, articleStatus: "published", linked: true },
      { visibility: "public", fileStatus: "active", deleted: true, articleStatus: "published", linked: true },
      { visibility: "public", fileStatus: "active", deleted: false, articleStatus: "published", linked: false },
    ]) {
      Object.assign(state, patch);
      const response = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-test"));
      assert.equal(response.status, 404);
    }
    assert.equal(downloads, 0);
  } finally { globalThis.fetch = originalFetch; }
});
