import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const state = {
  visibility: "public",
  fileStatus: "active",
  deleted: false,
  module: "materias",
  category: "content",
  mimeType: "image/jpeg",
  interviewAudioLinked: false,
  interviewThumbLinked: false,
  articleStatus: "published",
  articleContentLinked: true,
  articleGalleryLinked: true,
  projectPublished: true,
  projectGalleryLinked: true,
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
          if (table !== "drive_files") return { data: null, error: new Error("unexpected single table " + table) };
          const ok = state.visibility === "public" && state.fileStatus === "active" && !state.deleted;
          return ok ? { data: {
            id: "metadata-id",
            drive_file_id: "physical-drive-id",
            name: "photo.jpg",
            mime_type: state.mimeType,
            size_bytes: 3,
            module: state.module,
            entity_id: state.module === "materias" ? "article-id" : "project-id",
            category: state.category,
          }, error: null } : { data: null, error: new Error("not found") };
        },
        async maybeSingle() {
          if (table === "materias") {
            if (state.articleStatus !== "published") return { data: null, error: null };
            return { data: {
              id: "article-id",
              status: "published",
              capa_drive_file_id: null,
              capa_thumb_drive_file_id: null,
              banner_drive_file_id: null,
              audio_drive_file_id: null,
              content_blocks: [
                ...(state.articleContentLinked ? [{ drive_file_id: "metadata-id" }] : []),
                ...((state.interviewAudioLinked || state.interviewThumbLinked) ? [{ type: "interview_collection", interviews: [{ audioDriveFileId: state.interviewAudioLinked ? "metadata-id" : null, thumbnailDriveFileId: state.interviewThumbLinked ? "metadata-id" : null }] }] : []),
              ],
            }, error: null };
          }
          if (table === "projetos") {
            if (!state.projectPublished) return { data: null, error: null };
            return { data: { id: "project-id", capa_drive_file_id: null, cover_card_drive_file_id: null }, error: null };
          }
          if (table === "materia_galeria") {
            return state.articleGalleryLinked ? { data: { id: "article-gallery-row" }, error: null } : { data: null, error: null };
          }
          return { data: null, error: new Error("unexpected maybeSingle table " + table) };
        },
        async limit() {
          if (table !== "projeto_galeria") return { data: [], error: new Error("unexpected limit table " + table) };
          return { data: state.projectGalleryLinked ? [{ id: "project-gallery-row" }] : [], error: null };
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

async function withDriveFetch(run) {
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
  try { await run(() => downloads); }
  finally { globalThis.fetch = originalFetch; }
}

test("same article media slug is revalidated after the article is unpublished", async () => {
  await withDriveFetch(async (downloads) => {
    Object.assign(state, { visibility: "public", fileStatus: "active", deleted: false, module: "materias", category: "content", articleStatus: "published", articleContentLinked: true });
    const first = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-test"));
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Cache-Control"), "public, max-age=0, s-maxage=0, must-revalidate");

    state.articleStatus = "draft";
    const second = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-test"));
    assert.equal(second.status, 404);
    assert.equal(downloads(), 1, "unpublished media must not trigger another Drive download");
  });
});

test("article gallery media is denied as soon as its gallery relation is removed", async () => {
  await withDriveFetch(async (downloads) => {
    Object.assign(state, { visibility: "public", fileStatus: "active", deleted: false, module: "materias", category: "gallery", articleStatus: "published", articleGalleryLinked: true });
    const first = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-gallery-test"));
    assert.equal(first.status, 200);
    state.articleGalleryLinked = false;
    const second = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-gallery-test"));
    assert.equal(second.status, 404);
    assert.equal(downloads(), 1);
  });
});

test("project gallery media is denied after unpublishing or removing the gallery relation", async () => {
  await withDriveFetch(async (downloads) => {
    Object.assign(state, { visibility: "public", fileStatus: "active", deleted: false, module: "projetos", category: "gallery", projectPublished: true, projectGalleryLinked: true });
    const first = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=projetos-gallery-test"));
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("Cache-Control"), "public, max-age=0, s-maxage=0, must-revalidate");

    state.projectPublished = false;
    const unpublished = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=projetos-gallery-test"));
    assert.equal(unpublished.status, 404);

    state.projectPublished = true;
    state.projectGalleryLinked = false;
    const removed = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=projetos-gallery-test"));
    assert.equal(removed.status, 404);
    assert.equal(downloads(), 1);
  });
});

test("interview audio and thumbnail files remain linked to the published article", async () => {
  await withDriveFetch(async (downloads) => {
    Object.assign(state, { visibility: "public", fileStatus: "active", deleted: false, module: "materias", category: "audio", mimeType: "audio/mpeg", articleStatus: "published", articleContentLinked: false, interviewAudioLinked: true, interviewThumbLinked: false });
    const audio = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-interview-audio"));
    assert.equal(audio.status, 200);
    state.interviewAudioLinked = false;
    const revokedAudio = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-interview-audio"));
    assert.equal(revokedAudio.status, 404);

    Object.assign(state, { category: "content", mimeType: "image/jpeg", interviewAudioLinked: false, interviewThumbLinked: true });
    const thumbnail = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-interview-thumbnail"));
    assert.equal(thumbnail.status, 200);
    state.interviewThumbLinked = false;
    const revokedThumbnail = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-interview-thumbnail"));
    assert.equal(revokedThumbnail.status, 404);
    assert.equal(downloads(), 2);
  });
});

test("private, archived and deleted media are denied before downloading from Drive", async () => {
  await withDriveFetch(async (downloads) => {
    Object.assign(state, { module: "materias", category: "content", articleStatus: "published", articleContentLinked: true });
    for (const patch of [
      { visibility: "private", fileStatus: "active", deleted: false },
      { visibility: "public", fileStatus: "archived", deleted: false },
      { visibility: "public", fileStatus: "active", deleted: true },
      { visibility: "public", fileStatus: "active", deleted: false, articleContentLinked: false },
    ]) {
      Object.assign(state, patch);
      const response = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-test"));
      assert.equal(response.status, 404);
    }
    assert.equal(downloads(), 0);
  });
});

test("HEAD authorization probe revalidates visibility without downloading original Drive bytes", async () => {
  await withDriveFetch(async (downloads) => {
    Object.assign(state, { visibility: "public", fileStatus: "active", deleted: false, module: "materias", category: "content", articleStatus: "published", articleContentLinked: true });
    const response = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-head-probe", { method: "HEAD" }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(downloads(), 0);
    state.articleStatus = "draft";
    const revoked = await handler(new Request("https://project.supabase.co/functions/v1/drive-media?id=materia-head-probe", { method: "HEAD" }));
    assert.equal(revoked.status, 404);
    assert.equal(downloads(), 0);
  });
});
