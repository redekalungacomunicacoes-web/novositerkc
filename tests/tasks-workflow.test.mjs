import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
const bridge = await readFile(
  "supabase/migrations/20261002060419_tasks_workflow_legacy_bridge.sql",
  "utf8",
);
const migration = await readFile(
  "supabase/migrations/20261002054210_tasks_collaborative_checklists.sql",
  "utf8",
);
const own = "00000000-0000-0000-0000-000000000001",
  collab = "00000000-0000-0000-0000-000000000002",
  reviewer = "00000000-0000-0000-0000-000000000003",
  outsider = "00000000-0000-0000-0000-000000000004";
const task = "10000000-0000-0000-0000-000000000001",
  old = "10000000-0000-0000-0000-000000000002",
  file = "20000000-0000-0000-0000-000000000001",
  legacy = "20000000-0000-0000-0000-000000000002";
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role bypassrls; create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function is_team_admin() returns boolean language sql as $$select false$$;
 create table equipe(id uuid primary key,user_id uuid,ativo boolean);create table projetos(id uuid primary key,titulo text);
 create table tasks(id uuid primary key,titulo text,descricao text,created_by uuid references equipe(id),assigned_to uuid references equipe(id),status text,updated_at timestamptz,direcionamento uuid[],data_inicio date,data_fim date,prioridade text);
 create table task_assignees(id uuid primary key default gen_random_uuid(),task_id uuid references tasks(id) on delete cascade,user_id uuid references equipe(id),unique(task_id,user_id));
 create table drive_files(id uuid primary key,task_id uuid references tasks(id) on delete cascade,status text);
 create table task_attachments(id uuid primary key,task_id uuid references tasks(id) on delete cascade);
 alter table tasks enable row level security;alter table task_assignees enable row level security;
 create policy read on tasks for select to authenticated using(true);create policy write on tasks for update to authenticated using(true) with check(true);
 create policy read on task_assignees for select to authenticated using(true);
 grant usage on schema public,auth to authenticated;grant select on equipe,projetos,task_assignees,drive_files,task_attachments to authenticated;grant select,update on tasks to authenticated;
 insert into equipe values('${own}','${own}',true),('${collab}','${collab}',true),('${reviewer}','${reviewer}',true),('${outsider}','${outsider}',true);
 insert into tasks(id,titulo,created_by,assigned_to,status) values('${task}','Entrega','${own}','${own}','em_andamento'),('${old}','Legado','${own}','${own}','concluida');
 insert into drive_files values('${file}','${task}','active');insert into task_attachments values('${legacy}','${task}');`);
  await db.exec(migration);
  await db.exec(
    await readFile(
      "supabase/migrations/20261002060239_tasks_workflow_function_acl.sql",
      "utf8",
    ),
  );
  const as = async (id) =>
    db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
    );
  await as(own);
  let version = 0;
  const mutate = async (
    action,
    payload = {},
    v = version,
    request = crypto.randomUUID(),
  ) => {
    const r = await db.query(
      `select mutate_task_workflow($1,$2,$3,$4,$5) result`,
      [task, action, payload, v, request],
    );
    version = r.rows[0].result.version;
    return r.rows[0].result;
  };
  return {
    db,
    as,
    mutate,
    get version() {
      return version;
    },
  };
}
test("checklist CRUD, order, attribution, empty progress, retries and stale concurrency", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.db.query("select * from task_checklist_progress")).rows.length,
      0,
    );
    const request = crypto.randomUUID();
    const a = await f.mutate("add", { title: "Verificar fontes" }, 0, request);
    assert.equal(a.percent, 0);
    assert.equal(
      (await f.mutate("add", { title: "Verificar fontes" }, 0, request))
        .replayed,
      true,
    );
    assert.equal(
      (await f.db.query("select * from task_checklist_items")).rows.length,
      1,
    );
    await assert.rejects(
      f.mutate("add", { title: "duplicado" }, 0),
      /outra sessão/,
    );
    await f.mutate("add", { title: "Revisar" });
    let rows = (
      await f.db.query("select * from task_checklist_items order by position")
    ).rows;
    await f.mutate("order", { ids: rows.map((i) => i.id).reverse() });
    assert.equal(
      (
        await f.db.query(
          "select title from task_checklist_items order by position",
        )
      ).rows[0].title,
      "Revisar",
    );
    await assert.rejects(
      f.mutate("order", { ids: [rows[0].id, rows[0].id] }),
      /uma única vez/,
    );
    await f.mutate("edit", {
      item_id: rows[0].id,
      title: "Verificar dados",
      note: "Conferir fonte primária",
    });
    assert.equal(
      (await f.mutate("toggle", { item_id: rows[0].id, completed: true }))
        .percent,
      50,
    );
    assert.equal(
      (
        await f.db.query(
          "select completed_by from task_checklist_items where id=$1",
          [rows[0].id],
        )
      ).rows[0].completed_by,
      own,
    );
    assert.equal(
      (await f.mutate("toggle", { item_id: rows[0].id, completed: false }))
        .percent,
      0,
    );
    for (const r of rows) await f.mutate("delete", { item_id: r.id });
    assert.equal((await f.mutate("metadata", {})).percent, null);
    assert.equal(
      (await f.db.query("select * from task_workflow_history")).rows.length,
      9,
    );
  } finally {
    await f.db.close();
  }
});
test("templates require explicit repeat mode, create independent copies, and replace preserves files", async () => {
  const f = await fixture();
  try {
    await f.mutate("template", {
      steps: [{ title: "Captar" }, { title: "Editar" }],
    });
    await assert.rejects(
      f.mutate("template", { steps: [{ title: "Revisar" }] }),
      /Escolha/,
    );
    await f.mutate("template", {
      mode: "append",
      steps: [{ title: "Revisar" }],
    });
    assert.equal(
      (await f.db.query("select * from task_checklist_items")).rows.length,
      3,
    );
    const item = (
      await f.db.query("select id from task_checklist_items limit 1")
    ).rows[0].id;
    await f.mutate("link", {
      item_id: item,
      drive_file_id: file,
      purpose: "stage",
    });
    await f.mutate("template", {
      mode: "replace",
      steps: [{ title: "Entregar" }],
    });
    assert.equal(
      (await f.db.query("select * from task_file_links")).rows.length,
      0,
    );
    assert.equal(
      (await f.db.query("select * from drive_files")).rows.length,
      1,
    );
  } finally {
    await f.db.close();
  }
});
test("reviewer, collaborators, backend permissions, blocks, and legacy reopening", async () => {
  const f = await fixture();
  try {
    await f.mutate("metadata", {
      reviewer_id: reviewer,
      blocked_reason: "Falta autorização",
      blocked_by: collab,
    });
    assert.equal(
      (await f.db.query("select status from tasks where id=$1", [task])).rows[0]
        .status,
      "em_andamento",
    );
    await f.mutate("collaborators", { members: [collab] });
    await f.mutate("add", { title: "Finalizar" });
    const item = (await f.db.query("select id from task_checklist_items"))
      .rows[0].id;
    await assert.rejects(
      f.db.query(`update tasks set status='concluida' where id=$1`, [task]),
      /pendentes/,
    );
    await f.as(collab);
    await f.mutate("toggle", { item_id: item, completed: true });
    await assert.rejects(f.mutate("metadata", {}), /organizar/);
    await assert.rejects(f.mutate("complete"), /revisora/);
    await assert.rejects(
      f.db.query(
        `insert into task_checklist_items(task_id,title) values($1,'forged')`,
        [task],
      ),
      /permission denied/,
    );
    await f.as(own);
    await f.mutate("review");
    await f.as(reviewer);
    assert.equal((await f.db.query("select * from tasks")).rows.length, 1);
    await f.mutate("complete");
    await f.as(own);
    await assert.rejects(f.mutate("add", { title: "ampliar" }), /Reabra/);
    await assert.rejects(
      f.db.query(`update tasks set status='em_andamento' where id=$1`, [task]),
      /motivo/,
    );
    await f.mutate("reopen", { reason: "Ajuste solicitado" });
    await f.mutate("toggle", { item_id: item, completed: false });
    assert.equal(
      (await f.db.query("select status from tasks where id=$1", [old])).rows[0]
        .status,
      "concluida",
    );
    await f.as(outsider);
    assert.equal((await f.db.query("select * from tasks")).rows.length, 0);
    await assert.rejects(f.mutate("add", { title: "invadir" }), /Sem acesso/);
    await assert.rejects(
      f.db.query("select * from task_workflow_requests"),
      /permission denied/,
    );
  } finally {
    await f.db.close();
  }
});
test("stage/final links share metadata, detach preserves files, moves/trash/delete clean links", async () => {
  const f = await fixture();
  try {
    await f.mutate("add", { title: "Entregar" });
    const item = (await f.db.query("select id from task_checklist_items"))
      .rows[0].id;
    await f.mutate("link", {
      item_id: item,
      drive_file_id: file,
      purpose: "stage",
    });
    await f.mutate("link", { drive_file_id: file, purpose: "final" });
    await f.mutate("link", {
      item_id: item,
      drive_file_id: file,
      purpose: "stage",
    });
    assert.equal(
      (await f.db.query("select * from task_file_links")).rows.length,
      2,
    );
    await f.mutate("delete", { item_id: item });
    assert.equal(
      (await f.db.query("select * from drive_files")).rows.length,
      1,
    );
    assert.equal(
      (await f.db.query("select * from task_file_links")).rows.length,
      1,
    );
    await f.db.exec("reset role");
    await f.db.query("update drive_files set task_id=$1 where id=$2", [
      old,
      file,
    ]);
    await f.as(own);
    assert.equal(
      (await f.db.query("select * from task_file_links")).rows.length,
      0,
    );
    await assert.rejects(
      f.mutate("link", { drive_file_id: file, purpose: "final" }),
      /não pertence/,
    );
    await f.mutate("link", { legacy_attachment_id: legacy, purpose: "final" });
    await f.db.exec("reset role");
    await f.db.query("delete from task_attachments where id=$1", [legacy]);
    await f.as(own);
    assert.equal(
      (await f.db.query("select * from task_file_links")).rows.length,
      0,
    );
    await f.db.exec("reset role");
    await f.db.query("update drive_files set task_id=$1 where id=$2", [
      task,
      file,
    ]);
    await f.as(own);
    await f.mutate("link", { drive_file_id: file, purpose: "final" });
    await f.db.exec("reset role");
    await f.db.query("update drive_files set status='trashed' where id=$1", [
      file,
    ]);
    await f.as(own);
    assert.equal(
      (await f.db.query("select * from task_file_links")).rows.length,
      0,
    );
  } finally {
    await f.db.close();
  }
});
test("progress labels round and never suggest a percentage for empty checklists", async () => {
  const source = await readFile(
    "src/app/pages/admin/calendar2026/taskWorkflow.ts",
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  const { progressLabel, deliveryTemplates } = await import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
  assert.equal(progressLabel(6, 4), "4 de 6 etapas concluídas · 67%");
  assert.equal(progressLabel(0, 0), "Etapas ainda não definidas");
  assert.equal(Object.keys(deliveryTemplates).length, 6);
});

test("legacy checklist migration retains IDs and completion without rewriting completed tasks", async () => {
  const f = await fixture();
  try {
    await f.db.exec("reset role");
    await f.db.exec(
      `create table task_checklist(id uuid,task_id uuid,titulo text,concluida boolean,ordem integer,completed_by uuid,completed_at timestamptz,created_at timestamptz,updated_at timestamptz);`,
    );
    await f.db.query(
      `insert into task_checklist values($1,$2,'Legado concluído',true,2,$3,now(),now(),now())`,
      [legacy, old, own],
    );
    await f.db.exec(bridge);
    await f.db.exec(bridge);
    await f.as(own);
    const r = await f.db.query(
      "select id,completed_by,completed_at from task_checklist_items where task_id=$1",
      [old],
    );
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].id, legacy);
    assert.equal(r.rows[0].completed_by, own);
    assert.ok(r.rows[0].completed_at);
    assert.equal(
      (await f.db.query("select status from tasks where id=$1", [old])).rows[0]
        .status,
      "concluida",
    );
    assert.equal(
      (
        await f.db.query(
          "select has_function_privilege('anon','public.mutate_task_workflow(uuid,text,jsonb,integer,uuid)','execute') permitted",
        )
      ).rows[0].permitted,
      false,
    );
  } finally {
    await f.db.close();
  }
});
