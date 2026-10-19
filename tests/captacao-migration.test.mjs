import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => name.startsWith('20261019') && name.includes('_captacao_') && name.endsWith('.sql'))
  .sort();
assert.equal(migrationFiles.length, 7, 'expected all applied captação migrations to be present');
const migration = (await Promise.all(
  migrationFiles.map((name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')),
)).join('\n');

const ids = {
  reviewer: '00000000-0000-4000-8000-000000000101',
  manager: '00000000-0000-4000-8000-000000000102',
  outsider: '00000000-0000-4000-8000-000000000103',
  reviewerMember: '10000000-0000-4000-8000-000000000101',
  managerMember: '10000000-0000-4000-8000-000000000102',
};

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create schema storage;
    create function storage.foldername(text) returns text[] language sql immutable as $$
      select string_to_array(trim(both '/' from $1), '/')
    $$;
    create table public.roles(id uuid primary key default gen_random_uuid(), name text not null unique);
    create table public.user_roles(user_id uuid not null, role_id uuid not null references public.roles(id), primary key(user_id, role_id));
    create table public.equipe(id uuid primary key, user_id uuid, nome text not null, ativo boolean default true);
    create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
    grant select on public.roles, public.user_roles, public.equipe to authenticated;
    alter table public.roles enable row level security;
    alter table public.user_roles enable row level security;
    alter table public.equipe enable row level security;
    create policy roles_read_all on public.roles for select to authenticated using (true);
    create policy user_roles_read_own on public.user_roles for select to authenticated using (user_id = auth.uid());
    create policy equipe_read_own on public.equipe for select to authenticated using (user_id = auth.uid());
  `);
  await db.exec(migration);
  await db.exec(`
    insert into public.roles(name) values ('admin_alfa'), ('admin'), ('autor');
    insert into public.user_roles(user_id, role_id)
      select '${ids.reviewer}', id from public.roles where name='autor';
    insert into public.user_roles(user_id, role_id)
      select '${ids.manager}', id from public.roles where name='admin_alfa';
    insert into public.equipe(id,user_id,nome) values
      ('${ids.reviewerMember}','${ids.reviewer}','Isabelle'),
      ('${ids.managerMember}','${ids.manager}','Felipe');
  `);
  return db;
}

async function asUser(db, userId, sql) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try { return await sql(); }
  finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}

test('seeds the three opportunities as unconfirmed with only the provided deadline', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows } = await db.query('select protocol, deadline, status, eligibility_status from public.captacao_editais order by protocol');
  assert.deepEqual(rows.map((r) => r.protocol), ['RKC-CAP-2026-001','RKC-CAP-2026-002','RKC-CAP-2026-003']);
  assert.equal(rows[0].deadline.toISOString().slice(0,10), '2026-11-11');
  assert.deepEqual(rows.slice(1).map((r) => r.deadline), [null, null]);
  assert.ok(rows.every((r) => r.status === 'pending_confirmation' && r.eligibility_status === 'pending_verification'));
});

test('allows submitted applications to wait for evaluation without approving eligibility', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  await db.query("insert into public.captacao_editais (title, funder, category, status, eligibility_status) values ('Prêmio Pretas Potências — Projeto KaluCast', 'Prêmio Pretas Potências', 'Comunicação e Cultura Digital', 'aguardando_avaliacao', 'pending_verification')");
  const { rows } = await db.query("select status, eligibility_status, manager_approved_at from public.captacao_editais where title like '%KaluCast%'");
  assert.equal(rows[0].status, 'aguardando_avaliacao');
  assert.equal(rows[0].eligibility_status, 'pending_verification');
  assert.equal(rows[0].manager_approved_at, null);
});

test('RLS grants access to panel roles and hides records from other authenticated users', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows: hidden } = await asUser(db, ids.outsider, () => db.query('select id from public.captacao_editais'));
  const { rows: visible } = await asUser(db, ids.reviewer, () => db.query('select id from public.captacao_editais'));
  assert.equal(hidden.length, 0);
  assert.equal(visible.length, 3);
});

test('does not expose privileged helpers or trigger functions through anon RPC', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows } = await db.query(`
    select p.proname,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
    from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname in ('can_access_captacao','is_captacao_manager','captacao_assign_protocol','captacao_guard_editais','captacao_audit_change','captacao_invalidate_eligibility')
  `);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => !r.anon_execute), 'anon must not execute captação functions');
  assert.equal(rows.find((r) => r.proname === 'can_access_captacao').authenticated_execute, true);
  assert.equal(rows.find((r) => r.proname === 'is_captacao_manager').authenticated_execute, true);
  assert.ok(rows.filter((r) => !['can_access_captacao','is_captacao_manager'].includes(r.proname)).every((r) => !r.authenticated_execute));
});

test('rejects inserted editais that bypass eligibility and manager approval', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  await asUser(db, ids.reviewer, async () => {
    await assert.rejects(
      db.query("insert into public.captacao_editais(title,funder,status,eligibility_status,eligibility_opinion,manager_approved_at) values ('Teste','Fundo','em_elaboracao','approved','Parecer',now())"),
      /iniciam sem aprovação/i,
    );
  });
});

test('audit log identifies an authorized user without an equipe link', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows } = await db.query("select id from public.captacao_editais where protocol='RKC-CAP-2026-001'");
  await db.query('delete from public.equipe where user_id=$1', [ids.reviewer]);
  await asUser(db, ids.reviewer, async () => {
    await db.query("insert into public.captacao_tarefas(edital_id,title) values ($1,'Tarefa rastreável')", [rows[0].id]);
  });
  const { rows: audit } = await db.query("select actor_name from public.captacao_auditoria where entity='captacao_tarefas' order by created_at desc limit 1");
  assert.equal(audit[0].actor_name, `Usuário ${ids.reviewer.slice(0,8)}`);
});

test('adds indexes for captação foreign-key lookups', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows } = await db.query("select indexname from pg_indexes where schemaname='public' and indexname like 'captacao_%_idx'");
  assert.equal(rows.length, 10);
});

test('requires all requirements and a documented opinion before eligibility, then requires Felipe to release drafting', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows } = await db.query("select id from public.captacao_editais where protocol='RKC-CAP-2026-001'");
  const editalId = rows[0].id;
  await asUser(db, ids.reviewer, async () => {
    await db.query("insert into public.captacao_requisitos(edital_id,description,status) values ($1,'Requisito oficial','met')", [editalId]);
    await assert.rejects(db.query("update public.captacao_editais set eligibility_status='approved' where id=$1", [editalId]), /parecer/i);
    await db.query("update public.captacao_editais set eligibility_status='approved', eligibility_opinion='Requisitos conferidos na fonte oficial.' where id=$1", [editalId]);
    await assert.rejects(db.query("update public.captacao_editais set status='em_elaboracao' where id=$1", [editalId]), /gestor autorizar/i);
    await assert.rejects(db.query("update public.captacao_editais set manager_approved_at=now() where id=$1", [editalId]), /Felipe/i);
  });
  await asUser(db, ids.manager, async () => {
    await db.query("update public.captacao_editais set manager_approved_at=now(), status='em_elaboracao' where id=$1", [editalId]);
  });
  const { rows: final } = await db.query('select status, manager_approved_at from public.captacao_editais where id=$1', [editalId]);
  assert.equal(final[0].status, 'em_elaboracao');
  assert.ok(final[0].manager_approved_at);
  await asUser(db, ids.reviewer, async () => {
    await db.query("update public.captacao_requisitos set status='pending' where edital_id=$1", [editalId]);
  });
  const { rows: invalidated } = await db.query('select status, eligibility_status, manager_approved_at, eligibility_opinion from public.captacao_editais where id=$1', [editalId]);
  assert.equal(invalidated[0].status, 'pending_eligibility');
  assert.equal(invalidated[0].eligibility_status, 'pending_verification');
  assert.equal(invalidated[0].manager_approved_at, null);
  assert.equal(invalidated[0].eligibility_opinion, null);
});
