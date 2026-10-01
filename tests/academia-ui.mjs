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
  return { page, context, errors };
}
try {
  for (const role of ["admin_alfa", "admin", "editor", "autor", "financeiro"]) {
    const { page, context, errors } = await setup(role);
    const links = page.locator("aside nav a");
    assert.equal(await links.last().textContent(), "Academia");
    await page
      .getByRole("button", { name: "Cursos publicados", exact: true })
      .click();
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
      .getByRole("button", { name: "Editar meus cursos", exact: true })
      .click();
    const options = await page.locator("select option").allTextContents();
    assert.ok(options.some((t) => t.includes("Curso próprio")));
    assert.ok(!options.some((t) => t.includes("Curso da equipe")));
    await page.locator("select").first().selectOption("own");
    assert.equal(
      await page.getByRole("button", { name: "Publicar", exact: true }).count(),
      1,
    );
    if (role === "autor") {
      await page
        .getByRole("button", { name: "Novo curso", exact: true })
        .click();
      await page
        .getByLabel(/^Título(?: \*)?$/)
        .fill("Novo curso da autora");
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await page.getByText("Alteração salva.", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Cursos publicados", exact: true })
        .click();
      assert.equal(
        await page.getByText("Alteração salva.", { exact: true }).count(),
        0,
      );
      await page
        .getByRole("button", { name: "Editar meus cursos", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Novo curso", exact: true })
        .click();
      await page.getByLabel(/^Título(?: \*)?$/).fill("Outro curso");
      await page.getByRole("button", { name: "Salvar", exact: true }).click();
      await page.getByText("Alteração salva.", { exact: true }).waitFor();
      await page
        .getByText("Alteração salva.", { exact: true })
        .waitFor({ state: "hidden", timeout: 6000 });
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Desktop ${role}: menu, biblioteca sem edição e autoria OK`);
  }
  const { page, context, errors } = await setup("autor", true);
  await page
    .getByRole("button", { name: "Cursos publicados", exact: true })
    .click();
  assert.ok(
    await page
      .getByRole("button", { name: "Editar meus cursos", exact: true })
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
  await page
    .getByRole("link", { name: "Aula de leitura", exact: true })
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
