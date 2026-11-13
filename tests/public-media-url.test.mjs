import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = `export const __source = true;\n` + (await (await import("node:fs/promises")).readFile("src/lib/publicMediaUrl.ts", "utf8"));
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const helper = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const supabase = "https://project.supabase.co";
const worker = "https://worker.example";

test("rewrites only recognized public Drive image IDs from the configured Supabase origin", () => {
  assert.equal(
    helper.resolvePublicDriveImageUrl("https://project.supabase.co/functions/v1/drive-media?id=projetos-abc", supabase, worker),
    "https://worker.example/media?id=projetos-abc",
  );
  assert.equal(
    helper.resolvePublicDriveImageUrl("https://project.supabase.co/functions/v1/drive-media?id=private-file-abc", supabase, worker),
    "https://project.supabase.co/functions/v1/drive-media?id=private-file-abc",
  );
  assert.equal(
    helper.resolvePublicDriveImageUrl("https://other.supabase.co/functions/v1/drive-media?id=materia-abc", supabase, worker),
    "https://other.supabase.co/functions/v1/drive-media?id=materia-abc",
  );
  assert.equal(
    helper.resolvePublicDriveImageUrl("https://project.supabase.co/storage/v1/object/public/projetos/photo.jpg", supabase, worker),
    "https://project.supabase.co/storage/v1/object/public/projetos/photo.jpg",
  );
});

test("rewrites inline article HTML image URLs while preserving unrelated URLs", () => {
  const html = '<img src="https://project.supabase.co/functions/v1/drive-media?id=materia-abc"><img src="https://external.example/photo.jpg">';
  assert.equal(
    helper.rewritePublicDriveImageUrlsInHtml(html, supabase, worker),
    '<img src="https://worker.example/media?id=materia-abc"><img src="https://external.example/photo.jpg">',
  );
});
