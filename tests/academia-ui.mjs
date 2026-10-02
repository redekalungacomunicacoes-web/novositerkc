// Runs against `npm run dev` with fixture Supabase env; no production data is used.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const runtimeRequire = createRequire(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`
    : import.meta.url,
);
const { chromium } = runtimeRequire("playwright");
const user = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002";
const course = (id, title, creator, status = "published") => ({
  id,
  title,
  created_by: creator,
  status,
  summary: "Descrição do curso",
  slug: title.toLowerCase().replaceAll(" ", "-"),
  description: "Curso interno",
  cover_path: null,
  cover_drive_file_id: null,
  category_id: "category",
  level: "iniciante",
  hours: 2,
  competencies: [],
  objectives: "Aprender",
  audience: "Equipe",
  prerequisites: "",
  enrollment_mode: "self",
  access_mode: "internal",
  visibility: "internal",
  required: false,
  position: 0,
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
await mkdir("/tmp/rkc-academia-qa", { recursive: true });
async function setup(role, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  });
  const jwt = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: user,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 36000,
      iat: Math.floor(Date.now() / 1000),
    },
    "fixture",
  ]
    .map((v) =>
      typeof v === "string"
        ? v
        : Buffer.from(JSON.stringify(v)).toString("base64url"),
    )
    .join(".");
  await context.addInitScript(
    ({ jwt, user }) =>
      localStorage.setItem(
        "sb-fixture-auth-token",
        JSON.stringify({
          access_token: jwt,
          refresh_token: "fixture-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 36000,
          expires_in: 36000,
          token_type: "bearer",
          user: {
            id: user,
            aud: "authenticated",
            role: "authenticated",
            email: "fixture@example.invalid",
          },
        }),
      ),
    { jwt, user },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let courses = [
    course("own", "Curso próprio", user, "draft"),
    course("published", "Curso da equipe", other),
  ];
  const artwork = []; const artworkRequests = []; let failArtwork = true;
  const publishedLesson = {
    id: "lesson",
    course_id: "published",
    module_id: "module",
    title: "Aula de leitura",
    status: "published",
    type: "text",
    media_source: "youtube",
    media_url: "https://youtu.be/abcdefghijk",
    content: "Conteúdo da aula",
    duration_minutes: 10,
    required: false,
    position: 0,
  };
  await page.route("https://fixture.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body = [];
    const table = url.pathname.split("/").at(-1);
    if (table === "user_roles")
      body = [{ role_id: "role", roles: { name: role } }];
    if (table === "equipe")
      body = [
        { id: "member", user_id: user, nome: "Autoria RKC" },
        { id: "other", user_id: other, nome: "Equipe RKC" },
      ];
    if (table === "academy_settings")
      body = [
        {
          id: true,
          title: "Academia RKC",
          welcome_text: "Formação da equipe RKC",
        },
      ];
    if (table === "academy_categories")
      body = [{ id: "category", name: "Comunicação" }];
    if (table === "academy_courses") {
      if (req.method() === "POST") {
        const raw = req.postDataJSON(),
          row = Array.isArray(raw) ? raw[0] : raw;
        const saved = {
          ...course("new-course", row.title, user, "draft"),
          ...row,
        };
        courses.push(saved);
        body = saved;
      } else body = courses;
    }
    if (table === "academy_modules")
      body = [
        {
          id: "module",
          course_id: "published",
          title: "Módulo da equipe",
          position: 0,
        },
      ];
    if (table === "academy_lessons") body = [publishedLesson];
    if (table === "user") body = { id: user };
    if (table === "drive_files") body = artwork;
    if (table === "drive-files" && req.headers()["content-type"]?.includes("multipart/form-data")) {
      const raw = req.postDataBuffer().toString();
      const field = name => raw.match(new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r]+)'))?.[1];
      assert.equal(field("kind"), "banner"); assert.equal(field("module"), "academy-banner");
      const op = field("upload_id"); artworkRequests.push(op);
      if (failArtwork) { failArtwork=false; return route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({ok:false,error:"Falha simulada no banco; tente novamente."})}); }
      let file = artwork.find(f=>f.academy_upload_id===op);
      if (!file) {
        artwork.forEach(f=>{f.status="trashed";});
        file={id:crypto.randomUUID(),name:"banner.png",academy_course_id:"own",academy_kind:"banner",academy_upload_id:op,status:"active",visibility:"private",module:"academy",mime_type:"image/png",created_at:new Date().toISOString()};
        artwork.push(file); courses.find(c=>c.id==="own").banner_drive_file_id=file.id;
      }
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,file})});
    }
    if (table === "drive-files" && req.headers()["content-type"]?.includes("application/json")) {
      const request=req.postDataJSON();
      if(request.action==="download")return route.fulfill({status:200,contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7V0AAAAASUVORK5CYII=","base64")});
      if(request.action==="academy-trash") {artwork.find(f=>f.id===request.id).status="trashed";courses.find(c=>c.id==="own").banner_drive_file_id=null;return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});}
    }
    if (table === "drive-files")
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Pasta Academia não confirmada na RKC.",
        }),
      });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  });
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<p>Fixture player</p>",
    }),
  );
  await page.goto("http://127.0.0.1:5173/admin/academia");
  await page
    .getByRole("heading", { name: "Minha Academia", exact: true })
    .waitFor();
  return { page, context, errors, artwork, artworkRequests };
}
try {
  for (const role of ["admin_alfa", "admin", "editor", "autor", "financeiro"]) {
    const { page, context, errors, artwork, artworkRequests } = await setup(role, role === "autor");
    const links = page.locator("aside nav a");
    assert.equal(await links.last().textContent(), "Academia");
    assert.ok(
      await page
        .getByRole("heading", { name: "Curso da equipe", exact: true })
        .isVisible(),
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Curso próprio", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("button", { name: "Editar", exact: true }).count(),
      0,
    );
    await page
      .getByRole("button", { name: "Gestão de cursos", exact: true })
      .click();
    assert.equal(
      await page.getByRole("heading", { name: "Curso próprio", exact: true }).count(),
      1,
    );
    assert.equal(
      await page.getByRole("heading", { name: "Curso da equipe", exact: true }).count(),
      ["admin_alfa", "admin"].includes(role) ? 1 : 0,
    );
    await page.getByRole("searchbox", { name: /Buscar por curso/ }).fill("Curso próprio");
    assert.equal(
      await page.getByRole("button", { name: "Duplicar curso Curso próprio" }).count(),
      1,
    );
    assert.equal(
      await page.getByRole("button", { name: "Excluir curso Curso próprio" }).count(),
      1,
    );
    await page.getByRole("button", { name: "Editar curso Curso próprio" }).click();
    await page.waitForURL("**/admin/academia/cursos/own/editar");
    await page.getByText("Edição dedicada", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Voltar aos cursos", exact: true }).count(),
      1,
    );
    // Banner starts automatically, retains selection on failure and reuses the upload token.
    const image={name:"banner.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7V0AAAAASUVORK5CYII=","base64")};
    await page.locator('#academy-hero-banner-own').setInputFiles(image);
    await page.getByText("Falha simulada no banco; tente novamente.",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Tentar salvar banner",exact:true}).click();
    await page.getByRole("button",{name:"Remover banner",exact:true}).waitFor();
    assert.equal(artworkRequests.length,2);assert.equal(artworkRequests[0],artworkRequests[1]);assert.equal(artwork.length,1);
    await page.getByRole("img",{name:"Banner de Curso próprio",exact:true}).waitFor();
    await Promise.all([page.waitForResponse(r=>r.url().endsWith('/functions/v1/drive-files') && r.request().headers()['content-type']?.includes('multipart/form-data')), page.locator('#academy-hero-banner-own').setInputFiles({...image,name:"banner-novo.png"})]);
    await page.waitForFunction(()=>!document.querySelector('[role=status]')?.textContent?.includes("Salvando"));
    await page.getByRole("img",{name:"Banner de Curso próprio",exact:true}).waitFor();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="Remover banner" && !b.disabled));
    assert.equal(artwork.length,2);assert.equal(artwork.filter(f=>f.status==="active").length,1);
    assert.ok(await page.locator("section").evaluateAll(sections=>sections.every(s=>s.scrollWidth<=s.clientWidth)),"Course sections must not clip their content horizontally");
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Banner editor must fit viewport");
    await page.screenshot({path:"/tmp/rkc-academia-qa/banner-"+role+".png",fullPage:true});
    page.once("dialog",dialog=>dialog.accept());await Promise.all([page.waitForResponse(r=>r.url().endsWith("/functions/v1/drive-files") && r.request().headers()["content-type"]?.includes("application/json") && r.request().postDataJSON().action==="academy-trash"), page.getByRole("button",{name:"Remover banner",exact:true}).click()]);
    await page.getByRole("button",{name:"Remover banner",exact:true}).waitFor({state:"hidden"});assert.equal(artwork.filter(f=>f.status==="active").length,0);
    if (role === "autor") {
      await page.getByRole("button", { name: "Voltar aos cursos", exact: true }).click();
      await page.waitForURL("**/admin/academia");
      await page
        .getByRole("button", { name: "Gestão de cursos", exact: true })
        .click();
      assert.equal(
        await page.getByRole("button", { name: "Novo curso", exact: true }).count(),
        1,
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Desktop ${role}: menu, biblioteca sem edição e autoria OK`);
  }
  const { page, context, errors } = await setup("autor", true);
  assert.ok(
    await page
      .getByRole("button", { name: "Gestão de cursos", exact: true })
      .isVisible(),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/tmp/rkc-academia-qa/mobile-library.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Conhecer curso", exact: true }).click();
  await page.getByRole("button", { name: /Módulos e aulas/ }).click();
  await page
    .getByRole("link", { name: "Aula de leitura (opcional)", exact: true })
    .click();
  await page.getByTitle("Aula de leitura").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Editar", exact: true }).count(),
    0,
  );
  await page.screenshot({
    path: "/tmp/rkc-academia-qa/mobile-study.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Mobile: biblioteca sem overflow e estudo sem edição OK");
} finally {
  await browser.close();
}
