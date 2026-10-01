import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const base = await readFile(
  new URL(
    "../supabase/migrations/20261001180000_academia_rkc.sql",
    import.meta.url,
  ),
  "utf8",
);
const delta = await readFile(
  new URL(
    "../supabase/migrations/20261001194332_academia_autoria_drive.sql",
    import.meta.url,
  ),
  "utf8",
);
const owner = "00000000-0000-0000-0000-000000000001",
  reader = "00000000-0000-0000-0000-000000000002",
  admin = "00000000-0000-0000-0000-000000000003";
const course = "10000000-0000-0000-0000-000000000001",
  other = "10000000-0000-0000-0000-000000000002",
  lesson = "20000000-0000-0000-0000-000000000001";
const upload = "30000000-0000-0000-0000-000000000001";
async function as(db, id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role;
 create table roles(id uuid primary key default gen_random_uuid(),name text); create table user_roles(user_id uuid,role_id uuid);
 create table equipe(id uuid primary key default gen_random_uuid(),user_id uuid,nome text); grant select on equipe to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;
 create table drive_files(id uuid primary key default gen_random_uuid(),drive_file_id text unique,drive_folder_id text,name text,mime_type text,size_bytes bigint,module text,entity_id uuid,uploaded_by uuid,visibility text,status text,public_slug text,task_id uuid,deleted_at timestamptz,updated_at timestamptz);
 alter table drive_files enable row level security;
 grant select,insert,update,delete on drive_files to authenticated,anon;
 create policy broad_drive_read on drive_files for select to authenticated,anon using(true);
 create policy broad_drive_write on drive_files for all to authenticated using(true) with check(true);
 `);
  await db.exec(base);
  await db.exec(delta);
  for (const [id, role] of [
    [owner, "autor"],
    [reader, "financeiro"],
    [admin, "admin"],
  ]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into equipe(user_id,nome) values($1,$2)", [
      id,
      role,
    ]);
    await db.query(
      "with r as(insert into roles(name) values($2) returning id) insert into user_roles select $1,id from r",
      [id, role],
    );
  }
  await as(db, owner);
  await db.query(
    "insert into academy_courses(id,title,slug,enrollment_mode) values($1,'Own','own','manual')",
    [course],
  );
  await db.query(
    "insert into academy_modules(id,course_id,title) values($1,$2,'Module')",
    [other, course],
  );
  await db.query(
    "insert into academy_lessons(id,course_id,module_id,title,status) values($1,$2,$3,'Lesson','draft')",
    [lesson, course, other],
  );
  return db;
}
test("author owns drafts, reader sees published manual courses and cannot edit; admin rule stays explicit", async () => {
  const db = await fixture();
  try {
    await as(db, reader);
    assert.equal(
      (await db.query("select * from academy_courses")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update academy_courses set title='forged' where id=$1 returning id",
          [course],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into academy_courses(title,slug,created_by) values($1,$2,$3)",
        ["Forged", "forged", owner],
      ),
      /row-level/,
    );
    await as(db, owner);
    await db.query(
      "update academy_courses set status='published' where id=$1",
      [course],
    );
    await assert.rejects(
      db.query("update academy_courses set created_by=$1 where id=$2", [
        reader,
        course,
      ]),
      /autoria/,
    );
    await as(db, reader);
    assert.equal(
      (await db.query("select * from academy_courses")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from academy_lessons")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("insert into academy_modules(course_id,title) values($1,$2)", [
        course,
        "Attack",
      ]),
      /row-level/,
    );
    assert.equal(
      (await db.query("select academy_can_edit($1) ok", [course])).rows[0].ok,
      false,
    );
    await as(db, admin);
    assert.equal(
      (await db.query("select academy_can_edit($1) ok", [course])).rows[0].ok,
      true,
    );
    await as(db, owner);
    await db.query("update academy_courses set status='draft' where id=$1", [
      course,
    ]);
    await as(db, reader);
    assert.equal(
      (await db.query("select * from academy_courses")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
async function commit(db, kind = "media", lid = lesson, op = upload) {
  await db.exec("reset role");
  return (
    await db.query(
      "select (academy_commit_drive($1,$2,$3,$4,$5,$6::jsonb)).*",
      [
        owner,
        course,
        lid,
        kind,
        op,
        JSON.stringify({
          id: op,
          folder_id: "real-folder-fixture",
          name: "Lesson.pdf",
          mimeType: "application/pdf",
          size: 123,
        }),
      ],
    )
  ).rows[0];
}
test("private file links are atomic, scoped to course/lesson and hidden by restrictive RLS despite broad policy", async () => {
  const db = await fixture();
  try {
    const file = await commit(db);
    await as(db, owner);
    assert.equal((await db.query("select * from drive_files")).rows.length, 1);
    assert.equal(
      (
        await db.query(
          "update drive_files set visibility=$1 where id=$2 returning id",
          ["public", file.id],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select academy_commit_drive($1,$2,null,$3,$4,$5::jsonb)", [
        owner,
        course,
        "cover",
        crypto.randomUUID(),
        "{}",
      ]),
      /permission denied/,
    );
    await db.query(
      "update academy_courses set status='published' where id=$1",
      [course],
    );
    await as(db, reader);
    assert.equal((await db.query("select * from drive_files")).rows.length, 0); // draft lesson
    await as(db, owner);
    await db.query(
      "update academy_lessons set status='published' where id=$1",
      [lesson],
    );
    await as(db, reader);
    assert.equal((await db.query("select * from drive_files")).rows.length, 1);
    await as(db, reader, "anon");
    await assert.rejects(
      db.query("select * from drive_files"),
      /permission denied/,
    );
    await as(db, owner);
    await db.query(
      "insert into academy_courses(id,title,slug) values($1,$2,$3)",
      [other, "Another", "another"],
    );
    await assert.rejects(
      db.query(
        "update academy_courses set cover_drive_file_id=$1 where id=$2",
        [file.id, other],
      ),
      /incompatível/,
    );
    await db.exec("reset role");
    await assert.rejects(
      db.query("update drive_files set visibility='public' where id=$1", [
        file.id,
      ]),
      /check constraint/,
    );
  } finally {
    await db.close();
  }
});
test("lease blocks concurrent uploads; retries reuse operation; remove unlinks and archives", async () => {
  const db = await fixture();
  try {
    await as(db, owner);
    assert.equal(
      (await db.query("select academy_drive_lock($1,$2) ok", [course, upload]))
        .rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query("select academy_drive_lock($1,$2) ok", [
          course,
          crypto.randomUUID(),
        ])
      ).rows[0].ok,
      false,
    );
    await as(db, reader);
    await assert.rejects(
      db.query("select academy_drive_lock($1,$2)", [
        course,
        crypto.randomUUID(),
      ]),
      /autorizado/,
    );
    const a = await commit(db);
    const b = await commit(db);
    assert.equal(a.id, b.id);
    assert.equal(
      (await db.query("select count(*) n from drive_files")).rows[0].n,
      1,
    );
    await db.query("select academy_unlink_drive($1)", [a.id]);
    assert.equal(
      (await db.query("select media_drive_file_id from academy_lessons"))
        .rows[0].media_drive_file_id,
      null,
    );
    assert.equal(
      (await db.query("select status from drive_files")).rows[0].status,
      "trashed",
    );
  } finally {
    await db.close();
  }
});
test("metadata rollback on invalid material and provider domain enforcement", async () => {
  const db = await fixture();
  try {
    await db.exec("reset role");
    await assert.rejects(
      db.query("select academy_commit_drive($1,$2,$3,$4,$5,$6::jsonb,$7)", [
        owner,
        course,
        lesson,
        "material",
        upload,
        JSON.stringify({ id: "file", name: "PDF", size: 10 }),
        other,
      ]),
      /Material incompatível/,
    );
    assert.equal((await db.query("select * from drive_files")).rows.length, 0);
    await as(db, owner);
    await assert.rejects(
      db.query(
        "update academy_lessons set media_source='youtube',media_url='https://youtube.com.evil.test/watch?v=abcdefghijk' where id=$1",
        [lesson],
      ),
      /Link inválido/,
    );
    await assert.rejects(
      db.query(
        "update academy_lessons set media_source='vimeo',media_url='https://evil.test@vimeo.com/123' where id=$1",
        [lesson],
      ),
      /Link inválido/,
    );
    await db.query(
      "update academy_lessons set media_source='youtube',media_url='https://www.youtube.com/watch?v=abcdefghijk' where id=$1",
      [lesson],
    );
  } finally {
    await db.close();
  }
});
test("legacy scoped instructor permission remains; authors cannot grant it to themselves", async () => {
  const db = await fixture();
  try {
    await db.exec("reset role");
    const member = (
      await db.query("select id from equipe where user_id=$1", [reader])
    ).rows[0].id;
    const instructor = (
      await db.query(
        "insert into academy_instructors(member_id) values($1) returning id",
        [member],
      )
    ).rows[0].id;
    await db.query(
      "insert into academy_course_instructors values($1,$2,true)",
      [course, instructor],
    );
    await as(db, reader);
    assert.equal(
      (await db.query("select academy_can_edit($1) ok", [course])).rows[0].ok,
      true,
    );
    await db.query(
      "update academy_courses set title='Scoped edit' where id=$1",
      [course],
    );
    await assert.rejects(
      db.query("insert into academy_course_instructors values($1,$2,false)", [
        course,
        crypto.randomUUID(),
      ]),
      /row-level/,
    );
  } finally {
    await db.close();
  }
});
test("material removal enables deletion without dropping content history or leaving a public file", async () => {
  const db = await fixture();
  try {
    const file = await commit(db, "material");
    await as(db, owner);
    await assert.rejects(
      db.query("delete from academy_materials where drive_file_id=$1", [
        file.id,
      ]),
      /Remova/,
    );
    await assert.rejects(
      db.query("delete from academy_courses where id=$1", [course]),
      /Remova/,
    );
    await db.exec("reset role");
    await db.query("select academy_unlink_drive($1)", [file.id]);
    await as(db, owner);
    await db.query("delete from academy_courses where id=$1", [course]);
    await db.exec("reset role");
    const archived = (
      await db.query(
        "select status,academy_course_id from drive_files where id=$1",
        [file.id],
      )
    ).rows[0];
    assert.equal(archived.status, "trashed");
    assert.equal(archived.academy_course_id, null);
  } finally {
    await db.close();
  }
});
test("private material replacement archives previous version and only exposes current version", async () => {
  const db = await fixture();
  try {
    const previous = await commit(db, "material");
    const material = (
      await db.query(
        "select id from academy_materials where drive_file_id=$1",
        [previous.id],
      )
    ).rows[0].id;
    const replacement = (
      await db.query(
        "select (academy_commit_drive($1,$2,$3,$4,$5,$6::jsonb,$7)).*",
        [
          owner,
          course,
          lesson,
          "material",
          crypto.randomUUID(),
          JSON.stringify({
            id: "replacement",
            name: "Replacement.pdf",
            mimeType: "application/pdf",
            size: 10,
          }),
          material,
        ],
      )
    ).rows[0];
    assert.notEqual(previous.id, replacement.id);
    assert.equal(
      (
        await db.query("select status from drive_files where id=$1", [
          previous.id,
        ])
      ).rows[0].status,
      "archived",
    );
    await as(db, owner);
    await db.query(
      "update academy_courses set status='published' where id=$1",
      [course],
    );
    await db.query(
      "update academy_lessons set status='published' where id=$1",
      [lesson],
    );
    await as(db, reader);
    assert.deepEqual(
      (await db.query("select id from drive_files")).rows.map((x) => x.id),
      [replacement.id],
    );
  } finally {
    await db.close();
  }
});
test("global root lease serializes first folder creation across different courses", async () => {
  const db = await fixture();
  try {
    await as(db, owner);
    assert.equal(
      (await db.query("select academy_drive_root_lock($1) ok", [upload]))
        .rows[0].ok,
      true,
    );
    await as(db, reader);
    assert.equal(
      (
        await db.query("select academy_drive_root_lock($1) ok", [
          crypto.randomUUID(),
        ])
      ).rows[0].ok,
      false,
    );
    await db.query("select academy_drive_root_unlock($1)", [
      crypto.randomUUID(),
    ]);
    assert.equal(
      (
        await db.query("select academy_drive_root_lock($1) ok", [
          crypto.randomUUID(),
        ])
      ).rows[0].ok,
      false,
    );
    await as(db, owner);
    await db.query("select academy_drive_root_unlock($1)", [upload]);
    await as(db, reader);
    assert.equal(
      (
        await db.query("select academy_drive_root_lock($1) ok", [
          crypto.randomUUID(),
        ])
      ).rows[0].ok,
      true,
    );
  } finally {
    await db.close();
  }
});
