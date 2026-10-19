import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20261019120000_captacao_editais.sql', import.meta.url), 'utf8');
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
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema storage;
    create function storage.foldername(text) returns text[] language sql immutable as $$
      select string_to_array(trim(both '/' from $1), '/')
    $$;
    create table public.roles(id uuid primary key default gen_random_uuid(), name text not null unique);
    create table public.user_roles(user_id uuid not null, role_id uuid not null references public.roles(id), primary key(user_id, role_id));
    create table public.equipe(id uuid primary key, user_id uuid, nome text not null, ativo boolean default true);
    create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
  `);
  await db.exec(migration);
  await db.exec(`
    insert into public.roles(name) values ('admin'), ('autor');
    insert into public.user_roles(user_id, role_id)
      select '${ids.reviewer}', id from public.roles where name='autor';
    insert into public.user_roles(user_id, role_id)
      select '${ids.manager}', id from public.roles where name='admin';
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

test('RLS grants access to panel roles and hides records from other authenticated users', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows: hidden } = await asUser(db, ids.outsider, () => db.query('select id from public.captacao_editais'));
  const { rows: visible } = await asUser(db, ids.reviewer, () => db.query('select id from public.captacao_editais'));
  assert.equal(hidden.length, 0);
  assert.equal(visible.length, 3);
});

test('requires all requirements and a documented opinion before eligibility, then requires Felipe to release drafting', async (t) => {
  const db = await fixture(); t.after(() => db.close());
  const { rows } = await db.query("select id from public.captacao_editais where protocol='RKC-CAP-2026-001'");
  const editalId = rows[0].id;
  await asUser(db, ids.reviewer, async () => {
    await db.query("insert into public.captacao_requisitos(edital_id,description,status) values ($1,'Requisito oficial','met')", [editalId]);
    await assert.rejects(db.query("update public.captacao_editais set eligibility_status='approved' where id=$1", [editalId]), /parecer/i);
    await db.query("update public.captacao_editais set eligibility_status='approved', eligibility_opinion='Requisitos conferidos na fonte oficial.' where id=$1", [editalId]);
    await assert.rejects(db.query("update public.captacao_editais set status='em_elaboracao' where id=$1", [editalId]), /gestor Felipe/i);
    await assert.rejects(db.query("update public.captacao_editais set manager_approved_at=now() where id=$1", [editalId]), /Felipe/i);
  });
  await asUser(db, ids.manager, async () => {
    await db.query("update public.captacao_editais set manager_approved_at=now(), status='em_elaboracao' where id=$1", [editalId]);
  });
  const { rows: final } = await db.query('select status, manager_approved_at from public.captacao_editais where id=$1', [editalId]);
  assert.equal(final[0].status, 'em_elaboracao');
  assert.ok(final[0].manager_approved_at);
});
