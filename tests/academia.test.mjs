import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const { PGlite } = createRequire(import.meta.url)("@electric-sql/pglite");
const sql = await readFile(
  new URL(
    "../supabase/migrations/20261001180000_academia_rkc.sql",
    import.meta.url,
  ),
  "utf8",
);
const ids = {
  admin: "00000000-0000-0000-0000-000000000001",
  author: "00000000-0000-0000-0000-000000000002",
  finance: "00000000-0000-0000-0000-000000000003",
  editor: "00000000-0000-0000-0000-000000000004",
  outsider: "00000000-0000-0000-0000-000000000005",
  alfa: "00000000-0000-0000-0000-000000000006",
  course: "10000000-0000-0000-0000-000000000001",
  manual: "10000000-0000-0000-0000-000000000002",
  module: "20000000-0000-0000-0000-000000000001",
  lesson: "30000000-0000-0000-0000-000000000001",
  optional: "30000000-0000-0000-0000-000000000002",
  draft: "30000000-0000-0000-0000-000000000003",
  activity: "40000000-0000-0000-0000-000000000001",
  question: "50000000-0000-0000-0000-000000000001",
};
async function fixture() {
  const db = new PGlite();
  await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,storage to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create table public.roles(id uuid primary key default gen_random_uuid(),name text not null);
 create table public.user_roles(user_id uuid,role_id uuid);
 create table public.equipe(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,nome text);
 grant select on public.equipe to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,delete on storage.objects to authenticated;
 `);
  await db.exec(sql);
  for (const [name, id] of Object.entries(ids).filter(([name]) =>
    ["admin", "author", "finance", "editor", "outsider", "alfa"].includes(name),
  )) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into equipe(user_id,nome) values($1,$2)", [
      id,
      name,
    ]);
    if (name !== "outsider") {
      const role =
        { author: "autor", finance: "financeiro", alfa: "admin_alfa" }[name] ||
        name;
      await db.query(
        "with r as (insert into roles(name) values($2) returning id) insert into user_roles select $1,id from r",
        [id, role],
      );
    }
  }
  await db.exec(`
 insert into academy_courses(id,title,slug,enrollment_mode,status) values('${ids.course}','Test course','test-course','self','published'),('${ids.manual}','Manual course','manual-course','manual','published');
 insert into academy_modules(id,course_id,title) values('${ids.module}','${ids.course}','Module');
 insert into academy_lessons(id,course_id,module_id,title,status) values('${ids.lesson}','${ids.course}','${ids.module}','Required lesson','published');
 insert into academy_lessons(id,course_id,module_id,title,status,required) values('${ids.optional}','${ids.course}','${ids.module}','Optional lesson','published',false),('${ids.draft}','${ids.course}','${ids.module}','Draft lesson','draft',true);
 insert into academy_activities(id,course_id,title,max_attempts) values('${ids.activity}','${ids.course}','Quiz',2);
 insert into academy_questions(id,activity_id,prompt,type,options) values('${ids.question}','${ids.activity}','Choose','choice',array['A','B']);
 insert into academy_answer_keys values('${ids.question}','A');
 update academy_activities set status='published' where id='${ids.activity}';
 insert into storage.objects(bucket_id,name) values('academy','${ids.course}/published.pdf'),('academy','${ids.course}/draft.pdf');
 update academy_lessons set media_path='${ids.course}/published.pdf' where id='${ids.lesson}';
 update academy_lessons set media_path='${ids.course}/draft.pdf' where id='${ids.draft}';
 `);
  return db;
}
async function as(db, user, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[user] || user,
  ]);
  await db.exec(`set role ${role}`);
}
async function enroll(db, user) {
  await as(db, user);
  return (await db.query("select academy_enroll($1) id", [ids.course])).rows[0]
    .id;
}
test("all five panel roles can read academy; outsiders and anonymous cannot", async () => {
  const db = await fixture();
  try {
    for (const user of ["admin", "alfa", "editor", "author", "finance"]) {
      await as(db, user);
      assert.equal(
        (await db.query("select academy_member() v")).rows[0].v,
        true,
      );
      assert.equal(
        (await db.query("select count(*) n from academy_courses")).rows[0].n,
        user === "admin" || user === "alfa" ? 2 : 1,
      );
    }
    await as(db, "outsider");
    assert.equal(
      (await db.query("select count(*) n from academy_courses")).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query("select academy_enroll($1)", [ids.course]),
      /autorizada/,
    );
    await as(db, "outsider", "anon");
    await assert.rejects(
      db.query("select academy_report()"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("real progress: start never completes; own completion and server grading derive course completion", async () => {
  const db = await fixture();
  try {
    const eid = await enroll(db, "author");
    await db.query("select academy_record_lesson($1,$2,false)", [
      eid,
      ids.lesson,
    ]);
    let r = (await db.query("select * from academy_report()")).rows[0];
    assert.equal(r.progress, 0);
    assert.equal(r.total_units, 2);
    assert.equal(r.completed_at, null);
    await db.query("select academy_record_lesson($1,$2,true)", [
      eid,
      ids.lesson,
    ]);
    r = (await db.query("select * from academy_report()")).rows[0];
    assert.equal(r.progress, 50);
    await db.query("select academy_submit($1,$2,$3::jsonb)", [
      eid,
      ids.activity,
      JSON.stringify([
        {
          question_id: ids.question,
          answer: "A",
          elapsed_seconds: 3,
          score: 100,
        },
      ]),
    ]);
    r = (await db.query("select * from academy_report()")).rows[0];
    assert.equal(r.progress, 100);
    assert.ok(r.completed_at);
    await db.query("select academy_record_lesson($1,$2,false)", [
      eid,
      ids.lesson,
    ]);
    assert.equal(
      (await db.query("select * from academy_report()")).rows[0].progress,
      100,
    );
    assert.equal(
      (await db.query("select count(*) n from academy_answer_keys")).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into academy_progress(enrollment_id,course_id,lesson_id) values($1,$2,$3)",
        [eid, ids.course, ids.optional],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query("select academy_refresh($1)", [eid]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("cross-user progress, attempts, reports and draft media are protected", async () => {
  const db = await fixture();
  try {
    const eid = await enroll(db, "author");
    await db.query("select academy_record_lesson($1,$2,true)", [
      eid,
      ids.lesson,
    ]);
    const fid = await enroll(db, "finance");
    assert.notEqual(eid, fid);
    assert.equal(
      (await db.query("select count(*) n from academy_progress")).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select * from academy_report()")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select academy_record_lesson($1,$2,true)", [eid, ids.lesson]),
      /autorizada/,
    );
    await assert.rejects(
      db.query("select academy_submit($1,$2,$3::jsonb)", [
        eid,
        ids.activity,
        "[]",
      ]),
      /autorizada/,
    );
    assert.equal(
      (await db.query("select count(*) n from academy_lessons")).rows[0].n,
      2,
    );
    assert.equal(
      (await db.query("select name from storage.objects")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        "insert into academy_courses(title,slug) values('Unauthorized','unauthorized')",
      ),
      /row-level security/,
    );
  } finally {
    await db.close();
  }
});
test("grading ignores client score, rejects incomplete answers, enforces attempts and blocks key mutation", async () => {
  const db = await fixture();
  try {
    const eid = await enroll(db, "author");
    await assert.rejects(
      db.query("select academy_submit($1,$2,$3::jsonb)", [
        eid,
        ids.activity,
        "[]",
      ]),
      /todas/,
    );
    for (let i = 0; i < 2; i++)
      await db.query("select academy_submit($1,$2,$3::jsonb)", [
        eid,
        ids.activity,
        JSON.stringify([
          { question_id: ids.question, answer: "B", score: 100 },
        ]),
      ]);
    const attempts = (
      await db.query("select score,status from academy_attempts")
    ).rows;
    assert.equal(attempts.length, 2);
    assert.ok(
      attempts.every((a) => a.score === "0.00" || Number(a.score) === 0),
    );
    assert.ok(attempts.every((a) => a.status === "failed"));
    await assert.rejects(
      db.query("select academy_submit($1,$2,$3::jsonb)", [
        eid,
        ids.activity,
        JSON.stringify([{ question_id: ids.question, answer: "A" }]),
      ]),
      /Limite/,
    );
    await as(db, "admin");
    await assert.rejects(
      db.query(
        "update academy_answer_keys set answer='B' where question_id=$1",
        [ids.question],
      ),
      /rascunho/,
    );
  } finally {
    await db.close();
  }
});
test("contributions require review; course-scoped instructors can edit but cannot grant themselves access", async () => {
  const db = await fixture();
  try {
    await as(db, "author");
    const cid = (
      await db.query(
        "insert into academy_contributions(title,content,status) values('Knowledge','Content','review') returning id",
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        "insert into academy_contributions(title,content,status) values('Bypass','Content','approved')",
      ),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query(
          "update academy_contributions set status='approved' where id=$1 returning id",
          [cid],
        )
      ).rows.length,
      0,
    );
    await as(db, "finance");
    assert.equal(
      (await db.query("select count(*) n from academy_contributions")).rows[0]
        .n,
      0,
    );
    await as(db, "admin");
    await db.query(
      "update academy_contributions set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=$1",
      [cid],
    );
    const instructor = (
      await db.query(
        "insert into academy_instructors(member_id) select id from equipe where user_id=$1 returning id",
        [ids.editor],
      )
    ).rows[0].id;
    await db.query(
      "insert into academy_course_instructors values($1,$2,true)",
      [ids.manual, instructor],
    );
    await as(db, "editor");
    await db.query("update academy_courses set title='Edited' where id=$1", [
      ids.manual,
    ]);
    assert.equal(
      (await db.query("select count(*) n from academy_contributions")).rows[0]
        .n,
      1,
    );
    await assert.rejects(
      db.query("insert into academy_course_instructors values($1,$2,true)", [
        ids.course,
        instructor,
      ]),
      /row-level security/,
    );
    assert.equal(
      (await db.query("select count(*) n from academy_answer_keys")).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("manual review is required for essays; only instructor/admin may grade", async () => {
  const db = await fixture();
  try {
    await as(db, "admin");
    const aid = (
      await db.query(
        "insert into academy_activities(course_id,title) values($1,'Essay') returning id",
        [ids.course],
      )
    ).rows[0].id;
    const qid = (
      await db.query(
        "insert into academy_questions(activity_id,prompt,type,points) values($1,'Describe','essay',2) returning id",
        [aid],
      )
    ).rows[0].id;
    await db.query(
      "update academy_activities set status='published' where id=$1",
      [aid],
    );
    const eid = await enroll(db, "author");
    const tid = (
      await db.query("select academy_submit($1,$2,$3::jsonb) id", [
        eid,
        aid,
        JSON.stringify([{ question_id: qid, answer: "My answer" }]),
      ])
    ).rows[0].id;
    const answer = (
      await db.query("select id from academy_answers where attempt_id=$1", [
        tid,
      ])
    ).rows[0].id;
    assert.equal(
      (await db.query("select status from academy_attempts where id=$1", [tid]))
        .rows[0].status,
      "pending",
    );
    const grades = JSON.stringify([
      { answer_id: answer, points: 2, feedback: "Well done" },
    ]);
    await assert.rejects(
      db.query("select academy_review_attempt($1,$2::jsonb)", [tid, grades]),
      /autorizada/,
    );
    await as(db, "admin");
    await assert.rejects(
      db.query("select academy_review_attempt($1,$2::jsonb)", [
        tid,
        JSON.stringify([{ answer_id: answer, points: 3 }]),
      ]),
      /inválida/,
    );
    await db.query("select academy_review_attempt($1,$2::jsonb)", [
      tid,
      grades,
    ]);
    assert.equal(
      (await db.query("select status from academy_attempts where id=$1", [tid]))
        .rows[0].status,
      "passed",
    );
    await assert.rejects(
      db.query("select academy_review_attempt($1,$2::jsonb)", [tid, grades]),
      /já revisada/,
    );
  } finally {
    await db.close();
  }
});
test("publication and availability prevent accidental public release or future enrollment", async () => {
  const db = await fixture();
  try {
    await as(db, "admin");
    await assert.rejects(
      db.query(
        "insert into academy_courses(title,slug,status,visibility,access_mode) values('Public','public','published','public','free')",
      ),
      /somente cursos internos/,
    );
    await db.query(
      "update academy_courses set available_from=now()+interval '1 day' where id=$1",
      [ids.course],
    );
    await as(db, "author");
    await assert.rejects(
      db.query("select academy_enroll($1)", [ids.course]),
      /autorizada/,
    );
    assert.equal(
      (await db.query("select count(*) n from academy_courses")).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("question + key RPC is atomic and restricted to course managers", async () => {
  const db = await fixture();
  try {
    await as(db, "admin");
    const aid = (
      await db.query(
        "insert into academy_activities(course_id,title) values($1,'Draft activity') returning id",
        [ids.course],
      )
    ).rows[0].id;
    const question = {
      activity_id: aid,
      prompt: "Which option?",
      type: "choice",
      options: ["One", "Two"],
      points: 2,
      position: 0,
      time_limit_seconds: 30,
    };
    const qid = (
      await db.query("select academy_save_question($1::jsonb,$2) id", [
        JSON.stringify(question),
        "One",
      ])
    ).rows[0].id;
    assert.equal(
      (
        await db.query(
          "select answer from academy_answer_keys where question_id=$1",
          [qid],
        )
      ).rows[0].answer,
      "One",
    );
    await assert.rejects(
      db.query("select academy_save_question($1::jsonb,$2)", [
        JSON.stringify({ ...question, id: qid, prompt: "", points: 0 }),
        "Two",
      ]),
      /check constraint/,
    );
    assert.equal(
      (
        await db.query("select prompt from academy_questions where id=$1", [
          qid,
        ])
      ).rows[0].prompt,
      "Which option?",
    );
    await as(db, "author");
    await assert.rejects(
      db.query("select academy_save_question($1::jsonb,$2)", [
        JSON.stringify(question),
        "Two",
      ]),
      /autorizada/,
    );
  } finally {
    await db.close();
  }
});
test("archived courses retain authorized history and enrollments with progress cannot be transferred", async () => {
  const db = await fixture();
  try {
    const eid = await enroll(db, "author");
    await db.query("select academy_record_lesson($1,$2,true)", [
      eid,
      ids.lesson,
    ]);
    await db.query("select academy_submit($1,$2,$3::jsonb)", [
      eid,
      ids.activity,
      JSON.stringify([{ question_id: ids.question, answer: "A" }]),
    ]);
    await as(db, "admin");
    await assert.rejects(
      db.query("update academy_enrollments set user_id=$1 where id=$2", [
        ids.finance,
        eid,
      ]),
      /transferida/,
    );
    await assert.rejects(
      db.query(
        "update academy_courses set visibility='public',access_mode='free' where id=$1",
        [ids.course],
      ),
      /somente cursos internos/,
    );
    await db.query("update academy_courses set status='archived' where id=$1", [
      ids.course,
    ]);
    await as(db, "author");
    assert.equal(
      (await db.query("select count(*) n from academy_courses")).rows[0].n,
      0,
    );
    const r = (await db.query("select * from academy_report()")).rows[0];
    assert.equal(r.course_title, "Test course");
    assert.equal(r.progress, 100);
    assert.ok(r.completed_at);
  } finally {
    await db.close();
  }
});
