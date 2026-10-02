import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const dataModule = (source) =>
  "data:text/javascript;base64," +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
  ).toString("base64");
const driveUrl = dataModule(
  await readFile(
    new URL("../supabase/functions/_shared/google-drive.ts", import.meta.url),
    "utf8",
  ),
);
const drive = await import(driveUrl);
const academy = await import(
  dataModule(
    (
      await readFile(
        new URL(
          "../supabase/functions/_shared/academy-drive.ts",
          import.meta.url,
        ),
        "utf8",
      )
    ).replace('"./google-drive.ts"', JSON.stringify(driveUrl)),
  )
);
const { videoEmbed } = await import(
  dataModule(
    await readFile(
      new URL("../src/app/pages/admin/academia/media.ts", import.meta.url),
      "utf8",
    ),
  )
);
const course = "10000000-0000-0000-0000-000000000001",
  lesson = "20000000-0000-0000-0000-000000000001",
  upload = "30000000-0000-0000-0000-000000000001";
function google({
  folder = "09_ACADEMIA",
  shared = true,
  name = "RKC - SISTEMA DO SITE",
  duplicate = false,
  openRoot = false,
  openAcademy = false,
  limited = true,
  failUpload = false,
} = {}) {
  const calls = [];
  globalThis.Deno = { env: { get: () => "fixture-only" } };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    const json = (v, status = 200) =>
      new Response(JSON.stringify(v), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    if (url.hostname === "oauth2.googleapis.com")
      return json({ access_token: "fixture-token" });
    if (url.pathname.includes("/drives/"))
      return json({ id: "shared", name: "Rede Kalunga Comunicações" });
    if (url.pathname.endsWith("/permissions")) {
      const fileId = url.pathname.split("/").at(-2);
      const isAcademyOrFile = ["academy", "uploaded"].includes(fileId);
      const directPublic = openAcademy && isAcademyOrFile;
      const inheritedPublic = openRoot && isAcademyOrFile;
      return json({
        permissions: [
          ...(directPublic
            ? [{ id: "public-direct", type: "anyone", role: "reader" }]
            : []),
          ...(inheritedPublic
            ? [{
                id: "public-inherited",
                type: "anyone",
                role: "reader",
                permissionDetails: [{ inherited: true }],
              }]
            : []),
          { id: "service", type: "user", role: "writer" },
        ],
      });
    }
    if (url.pathname === "/drive/v3/files" && !init.method) {
      const q = url.searchParams.get("q");
      const match = q.match(/name = '([^']+)'/);
      return json({
        files:
          match[1] === folder
            ? [{ id: "academy", name: folder }]
            : duplicate && match[1] === "Academia"
              ? [{ id: "duplicate" }]
              : [],
      });
    }
    if (url.pathname === "/drive/v3/files" && init.method === "POST")
      return json({ id: "child", name: JSON.parse(init.body).name });
    if (url.pathname === "/upload/drive/v3/files")
      return failUpload
        ? json({ error: "fixture upload failure" }, 503)
        : json({
            id: "uploaded",
            name: "PDF.pdf",
            mimeType: "application/pdf",
            size: 4,
          });
    if (init.method === "PATCH") return json({ id: "uploaded", trashed: true });
    if (url.searchParams.get("alt") === "media")
      return new Response("private-content", {
        headers: { "Content-Type": "application/pdf" },
      });
    if (url.pathname.endsWith("/uploaded"))
      return json({
        id: "uploaded",
        permissions: openAcademy ? [{ type: "anyone" }] : [{ type: "user" }],
      });
    const isAcademy = url.pathname.endsWith("/academy");
    return json({
      id: isAcademy ? "academy" : "root",
      name: isAcademy ? folder : name,
      mimeType: "application/vnd.google-apps.folder",
      driveId: shared ? "shared" : undefined,
      parents: ["root"],
      capabilities: { canAddChildren: true },
      permissions: (isAcademy ? openAcademy : openRoot)
        ? [{ type: "anyone" }]
        : [{ type: "user" }],
      inheritedPermissionsDisabled: isAcademy ? limited : false,
    });
  };
  return calls;
}
function clients({
  editable = true,
  commitError = false,
  existing = null,
  locked = true,
} = {}) {
  const calls = [];
  function query(value) {
    const q = {
      select: () => q,
      eq: () => q,
      single: async () => ({ data: value, error: null }),
      maybeSingle: async () => ({ data: value, error: null }),
    };
    return q;
  }
  const user = {
    from: () => query({ id: lesson, module_id: "module-id" }),
    rpc: async (name) => {
      calls.push(name);
      return {
        data:
          name === "academy_can_edit"
            ? editable
            : ["academy_drive_lock", "academy_drive_root_lock"].includes(name)
              ? locked
              : null,
        error: null,
      };
    },
  };
  const admin = {
    from: () => query(existing),
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: commitError
          ? null
          : { id: "metadata", academy_upload_id: upload },
        error: commitError ? { message: "Metadata failure" } : null,
      };
    },
  };
  return { user, admin, calls };
}
function form() {
  const f = new FormData();
  f.set("file", new File(["PDF!"], "PDF.pdf", { type: "application/pdf" }));
  f.set("course_id", course);
  f.set("lesson_id", lesson);
  f.set("upload_id", upload);
  f.set("kind", "material");
  return f;
}
test("existing limited-access Academy is reused; a public root is allowed", async () => {
  const calls = google({ openRoot: true });
  const found = await drive.resolveAcademyFolder("root");
  assert.equal(found.id, "academy");
  assert.equal(found.reused, true);
  assert.equal(
    calls.filter(
      (x) =>
        x.init.method === "POST" && x.url.hostname === "www.googleapis.com",
    ).length,
    0,
  );
});
test("public inherited permissions are ignored, direct public grants are rejected", async () => {
  google({ openRoot: true });
  assert.equal((await drive.resolveAcademyFolder("root")).id, "academy");
  google({ openRoot: true });
  await drive.assertPrivateDriveFile("uploaded");
  google({ openAcademy: true });
  await assert.rejects(drive.resolveAcademyFolder("root"), /permissão pública direta/);
  google({ openAcademy: true });
  await assert.rejects(drive.assertPrivateDriveFile("uploaded"), /acesso aberto/);
});
test("missing, duplicate, public and personal destinations stop before any folder/upload", async () => {
  for (const config of [
    { folder: "Absent" },
    { duplicate: true },
    { shared: false },
    { name: "Play Moments" },
    { openAcademy: true },
    { limited: false },
  ]) {
    const calls = google(config);
    await assert.rejects(drive.resolveAcademyFolder("root"));
    assert.equal(
      calls.filter(
        (x) =>
          x.init.method === "POST" && x.url.hostname === "www.googleapis.com",
      ).length,
      0,
    );
  }
});
test("upload succeeds only after private Google file and committed metadata; stable IDs form the path", async () => {
  const calls = google();
  const c = clients();
  const result = await academy.uploadAcademyDrive(
    form(),
    "root",
    c.user,
    c.admin,
    "owner",
  );
  assert.equal(result.id, "metadata");
  const folders = calls
    .filter(
      (x) => x.url.pathname === "/drive/v3/files" && x.init.method === "POST",
    )
    .map((x) => JSON.parse(x.init.body).name);
  assert.deepEqual(folders, [
    "Cursos",
    course,
    "Módulos",
    "module-id",
    "Aulas",
    lesson,
    "Materiais",
  ]);
  assert.ok(c.calls.some((x) => x.name === "academy_commit_drive"));
  assert.ok(c.calls.includes("academy_drive_unlock"));
  const downloaded = await drive.downloadDriveFile("uploaded");
  assert.equal(await downloaded.text(), "private-content");
});
test("reader cannot upload; lease collision creates no folder", async () => {
  for (const config of [{ editable: false }, { locked: false }]) {
    const calls = google();
    const c = clients(config);
    await assert.rejects(
      academy.uploadAcademyDrive(form(), "root", c.user, c.admin, "owner"),
    );
    assert.equal(
      calls.filter(
        (x) =>
          x.url.pathname === "/upload/drive/v3/files" ||
          (x.init.method === "POST" && x.url.hostname === "www.googleapis.com"),
      ).length,
      0,
    );
  }
});
test("Google upload failure and metadata failure never report success; metadata failure trashes orphan", async () => {
  let calls = google({ failUpload: true });
  let c = clients();
  await assert.rejects(
    academy.uploadAcademyDrive(form(), "root", c.user, c.admin, "owner"),
  );
  assert.ok(!c.calls.some((x) => x.name === "academy_commit_drive"));
  calls = google();
  c = clients({ commitError: true });
  await assert.rejects(
    academy.uploadAcademyDrive(form(), "root", c.user, c.admin, "owner"),
  );
  assert.equal(calls.filter((x) => x.init.method === "PATCH").length, 1);
  assert.ok(c.calls.includes("academy_drive_unlock"));
});
test("confirmed HTTP retry reuses metadata and does not upload twice", async () => {
  const calls = google();
  const c = clients({
    existing: {
      id: "metadata",
      uploaded_by: "owner",
      academy_course_id: course,
      academy_lesson_id: lesson,
      academy_kind: "material",
      status: "active",
    },
  });
  assert.equal(
    (await academy.uploadAcademyDrive(form(), "root", c.user, c.admin, "owner"))
      .id,
    "metadata",
  );
  assert.equal(calls.length, 0);
});
test("video preview validates exact domain, protocol and provider IDs", () => {
  assert.equal(
    videoEmbed("youtube", "https://youtu.be/abcdefghijk"),
    "https://www.youtube-nocookie.com/embed/abcdefghijk",
  );
  assert.equal(
    videoEmbed("vimeo", "https://vimeo.com/123456/abc123"),
    "https://player.vimeo.com/video/123456?h=abc123",
  );
  for (const url of [
    "http://youtube.com/watch?v=abcdefghijk",
    "https://youtube.com.evil.test/watch?v=abcdefghijk",
    "https://user@youtube.com/watch?v=abcdefghijk",
    "https://youtube.com:8443/watch?v=abcdefghijk",
    "https://youtube.com/watch?v=bad",
  ])
    assert.equal(videoEmbed("youtube", url), null);
  assert.equal(
    videoEmbed("vimeo", "https://player.vimeo.com/video/12345?h=evil<script>"),
    null,
  );
});
test("missing Academy folder is never auto-created under a public root", async () => {
  const calls = google({ folder: "Missing", openRoot: true });
  await assert.rejects(drive.resolveAcademyFolder("root"), /Crie 09_ACADEMIA/);
  assert.equal(
    calls.filter((x) => x.url.pathname === "/drive/v3/files" && x.init.method === "POST").length,
    0,
  );
});
test("HTTP endpoint denies anonymous access, reader writes and out-of-scope downloads", async () => {
  const source = await readFile(
    new URL("../supabase/functions/drive-files/index.ts", import.meta.url),
    "utf8",
  );
  const academyUrl = dataModule(
    (
      await readFile(
        new URL(
          "../supabase/functions/_shared/academy-drive.ts",
          import.meta.url,
        ),
        "utf8",
      )
    ).replace('"./google-drive.ts"', JSON.stringify(driveUrl)),
  );
  let handler,
    authorized = true,
    readable = true,
    editable = false,
    unlink = 0;
  const file = {
    id: "metadata",
    module: "academy",
    status: "active",
    academy_course_id: course,
    drive_file_id: "uploaded",
    mime_type: "application/pdf",
    name: "PDF.pdf",
  };
  globalThis.Deno = {
    env: { get: () => "fixture" },
    serve: (fn) => {
      handler = fn;
    },
  };
  globalThis.__academyCreateClient = (_url, key) =>
    key === "fixture-service"
      ? {
          from: () => query(file),
          rpc: async () => {
            unlink++;
            return { error: null };
          },
        }
      : {
          auth: {
            getUser: async () => ({
              data: { user: authorized ? { id: "reader" } : null },
              error: null,
            }),
          },
          from: () => query(readable ? { id: "metadata" } : null),
          rpc: async () => ({ data: editable, error: null }),
        };
  function query(value) {
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      maybeSingle: async () => ({ data: value, error: null }),
    };
    return q;
  }
  globalThis.Deno.env.get = (key) =>
    key === "SUPABASE_SERVICE_ROLE_KEY" ? "fixture-service" : "fixture";
  await import(
    dataModule(
      source
        .replace(
          'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
          "const createClient = globalThis.__academyCreateClient;",
        )
        .replace(
          '"../_shared/cors.ts"',
          JSON.stringify(
            dataModule(
              'export const corsHeaders={"Access-Control-Allow-Origin":"*"};',
            ),
          ),
        )
        .replace('"../_shared/google-drive.ts"', JSON.stringify(driveUrl))
        .replace('"../_shared/academy-drive.ts"', JSON.stringify(academyUrl))
        .replace('"../_shared/task-drive.ts"', JSON.stringify(dataModule('export async function prepareTaskFolder(){ throw new Error("unused"); }')) )
        .replace('"../_shared/task-delete.ts"', JSON.stringify(dataModule('export async function deleteTaskAndQueueCleanup(){ throw new Error("unused"); } export async function retryTaskCleanup(){ throw new Error("unused"); }'))),
    )
  );
  const send = (action) =>
    handler(
      new Request("https://fixture/drive-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fixture",
        },
        body: JSON.stringify({ id: "metadata", action }),
      }),
    );
  authorized = false;
  assert.equal((await send("download")).status, 401);
  authorized = true;
  readable = false;
  assert.equal((await send("download")).status, 403);
  readable = true;
  for (const action of ["academy-trash", "visibility", "rename", "move"])
    assert.equal((await send(action)).status, 403);
  const googleCalls = google();
  globalThis.Deno.env.get = (key) =>
    key === "SUPABASE_SERVICE_ROLE_KEY" ? "fixture-service" : "fixture";
  let response = await send("download");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "private-content");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  editable = true;
  assert.equal((await send("visibility")).status, 403);
  response = await send("academy-trash");
  assert.equal(response.status, 200);
  assert.equal(unlink, 1);
  assert.ok(googleCalls.some((x) => x.init.method === "PATCH"));
});
test("authenticated downloads preserve exact bytes for JSON and text materials", async () => {
  globalThis.__academyDownloadClient = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "fixture" } },
        error: null,
      }),
    },
  };
  const code = (
    await readFile(
      new URL("../src/services/driveFiles.ts", import.meta.url),
      "utf8",
    )
  )
    .replace(
      'import { supabase } from "../lib/supabase";',
      "const supabase = globalThis.__academyDownloadClient;",
    )
    .replaceAll(
      "import.meta.env.VITE_SUPABASE_URL",
      '"https://fixture.supabase.co"',
    )
    .replaceAll("import.meta.env.VITE_SUPABASE_ANON_KEY", '"fixture-public"');
  const service = await import(dataModule(code));
  for (const [mime, content] of [
    ["application/json", '{ "original" : true }\n'],
    ["text/plain", "Original text\n"],
  ]) {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init.headers.Authorization, "Bearer fixture");
      return new Response(content, { headers: { "Content-Type": mime } });
    };
    const blob = await service.downloadRkcDriveFile("private-id");
    assert.equal(await blob.text(), content);
    assert.equal(blob.type, mime);
  }
});
