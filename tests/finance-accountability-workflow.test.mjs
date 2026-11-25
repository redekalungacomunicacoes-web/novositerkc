import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const ids = {
  operator: '00000000-0000-4000-8000-000000000101',
  admin: '00000000-0000-4000-8000-000000000102',
  outsider: '00000000-0000-4000-8000-000000000103',
};

async function setup(db) {
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.finance_funds(id uuid primary key default gen_random_uuid());
    create table public.finance_projects(id uuid primary key default gen_random_uuid());
    create table public.roles(id uuid primary key default gen_random_uuid(), name text not null unique);
    create table public.user_roles(user_id uuid references auth.users(id), role_id uuid references public.roles(id));
    create function public.set_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at := now(); return new; end
    $$;
    insert into auth.users values ('${ids.operator}'),('${ids.admin}'),('${ids.outsider}');
    insert into public.roles(name) values ('financeiro'),('admin');
    insert into public.user_roles
      select '${ids.operator}'::uuid, id from public.roles where name = 'financeiro'
      union all
      select '${ids.admin}'::uuid, id from public.roles where name = 'admin';
    insert into public.finance_funds default values;
    insert into public.finance_projects default values;
  `);

  const migrations = [
    '20261124090000_finance_accountability_templates.sql',
    '20261124190000_finance_accountability_edit_history.sql',
    '20261124195000_finance_accountability_deadline.sql',
    '20261124200000_finance_accountability_workflow.sql',
    '20261124204000_finance_accountability_evidence.sql',
  ];
  for (const file of migrations) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`
    grant usage on schema public, auth to authenticated, service_role;
    grant select, insert, update on public.finance_accountability_reports to authenticated, service_role;
    grant select on public.finance_reporting_templates, public.finance_funds, public.finance_projects to authenticated;
    grant select, insert on public.finance_accountability_history to authenticated;
    grant select, insert, update on public.finance_accountability_documents to authenticated, service_role;
    grant usage on all sequences in schema public to authenticated;
    insert into public.finance_reporting_templates(slug, name) values ('faj-ii-ciclo', 'FAJ II Ciclo');
  `);
}

async function asRole(db, role, userId, action) {
  await db.query('select set_config(\'request.jwt.claim.sub\', $1, false)', [userId ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await action();
  } finally {
    await db.exec('reset role');
  }
}

test('enforces the FAJ draft, review, approval, delivery and archive workflow and records an audit trail', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await setup(db);
  const asOperator = action => asRole(db, 'authenticated', ids.operator, action);
  const asAdmin = action => asRole(db, 'authenticated', ids.admin, action);
  const report = (await asOperator(() => db.query(`
    insert into public.finance_accountability_reports(template_id, fund_id, project_id, title, created_by)
    select template.id, fund.id, project.id, 'Prestações em teste', $1
    from public.finance_reporting_templates template, public.finance_funds fund, public.finance_projects project
    returning id, updated_at::text, created_by, fund_id, project_id
  `, [ids.admin]))).rows[0];
  const id = report.id;
  assert.equal(report.created_by, ids.operator);
  assert.ok(report.fund_id);
  assert.ok(report.project_id);
  let version = report.updated_at;
  const transition = async (action, notes = null, expected = version) => {
    const { rows } = await db.query(`
      select status, updated_at::text, review_notes, delivered_at, delivery_reference
      from public.advance_finance_accountability_workflow($1,$2,$3,$4)
    `, [id, expected, action, notes]);
    version = rows[0].updated_at;
    return rows[0];
  };

  await assert.rejects(asOperator(() => transition('submit')), { code: '22023' });
  await assert.rejects(asOperator(() => db.query(`
    update public.finance_accountability_reports set status = 'approved' where id = $1
  `, [id])), { code: '42501' });
  await assert.rejects(asOperator(() => db.query(`
    insert into public.finance_accountability_history(report_id, action)
    values ($1, 'approved')
  `, [id])), { code: '42501' });
  await assert.rejects(asRole(db, 'anon', null, () => transition('submit')), { code: '42501' });
  await assert.rejects(asRole(db, 'authenticated', ids.outsider, () => transition('submit')), { code: '42501' });

  const narrative = { institution: { organization_name: 'RKC' }, question_1: 'A', question_2: 'B', question_3: 'C', question_4: 'D' };
  const saveDraft = () => asOperator(() => db.query(`
    select public.save_finance_accountability_draft_revision($1, '{}', '{}', $2::jsonb, $3::jsonb)::text as saved
  `, [id, JSON.stringify(narrative), JSON.stringify({ team: [] })]));
  const nextVersion = (await saveDraft()).rows[0].saved;
  assert.ok(nextVersion);
  assert.equal((await saveDraft()).rows[0].saved, null);
  await assert.rejects(asOperator(() => transition('submit')), { code: '40001' });
  const addEvidence = (uploadId = 'test-upload') => asRole(db, 'service_role', null, () => db.query(`
    insert into public.finance_accountability_documents(report_id, document_type, file_name, storage_path, metadata, created_by)
    values ($1, 'supporting_attachment', 'evidencia.pdf', 'private-evidence', jsonb_build_object('upload_id', $2::text), $3)
  `, [id, uploadId, ids.operator]));
  await addEvidence();
  await assert.rejects(addEvidence(), { code: '23505' });
  version = nextVersion;
  assert.equal((await asOperator(() => transition('submit'))).status, 'in_review');
  await assert.rejects(asOperator(() => transition('approve')), { code: '42501' });
  await assert.rejects(asOperator(() => db.query(`
    update public.finance_accountability_reports set financial_data = '{"team":[],"workPlan":"x"}' where id = $1
  `, [id])), { code: '42501' });
  await assert.rejects(asAdmin(() => transition('return', '  ')), { code: '22023' });

  const returned = await asAdmin(() => transition('return', '  Conferir rubricas.  '));
  assert.equal(returned.status, 'draft');
  assert.equal(returned.review_notes, 'Conferir rubricas.');
  assert.equal((await asOperator(() => transition('submit'))).status, 'in_review');
  const approved = await asAdmin(() => transition('approve'));
  assert.equal(approved.status, 'approved');
  assert.equal(approved.review_notes, null);
  await assert.rejects(addEvidence('new-upload'), { code: '42501' });
  await assert.rejects(asAdmin(() => transition('archive')), { code: '22023' });

  await assert.rejects(asRole(db, 'service_role', null, () => db.query(`
    update public.finance_accountability_reports set narrative_data = '{}' where id = $1
  `, [id])), { code: '42501' });
  const addDocument = () => db.query(`
    insert into public.finance_accountability_documents(report_id, document_type, file_name, storage_path)
    values ($1, 'financial_spreadsheet', 'FAJ.xlsx', 'private-reference')
  `, [id]);
  await assert.rejects(asOperator(addDocument), { code: '42501' });
  await asRole(db, 'service_role', null, addDocument);

  const delivered = await asOperator(() => transition('deliver', 'Protocolo de teste'));
  assert.ok(delivered.delivered_at);
  assert.equal(delivered.delivery_reference, 'Protocolo de teste');
  await assert.rejects(asOperator(() => transition('deliver')), { code: '22023' });
  await assert.rejects(asOperator(() => transition('archive')), { code: '42501' });
  assert.equal((await asAdmin(() => transition('archive'))).status, 'archived');

  const audit = await db.query(`
    select action, actor_id, snapshot from public.finance_accountability_history where report_id = $1 order by id
  `, [id]);
  assert.deepEqual(audit.rows.map(row => row.action), [
    'created', 'updated', 'updated', 'submitted_for_review', 'returned_for_revision',
    'submitted_for_review', 'approved', 'delivered', 'archived',
  ]);
  assert.equal(audit.rows[6].actor_id, ids.admin);
  assert.equal(audit.rows[7].actor_id, ids.operator);
  assert.equal(audit.rows[7].snapshot.after.delivery_reference, 'Protocolo de teste');
  assert.deepEqual(audit.rows[8].snapshot.after.narrative_data, narrative);
});


test('only empty finance drafts can be safely removed from the dashboard', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await setup(db);
  for (const file of [
    '20261124201000_finance_accountability_sheet_sync.sql',
    '20261125004500_finance_accountability_discard_empty_drafts.sql',
  ]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  const create = title => asRole(db, 'authenticated', ids.operator, () => db.query(`
    insert into public.finance_accountability_reports(template_id,title)
    select id,$1 from public.finance_reporting_templates where slug='faj-ii-ciclo'
    returning id, updated_at::text
  `, [title]));

  const first = (await create('Rascunho vazio')).rows[0];
  const discard = (role, actor, report, version = report.updated_at) =>
    asRole(db, role, actor, () => db.query(
      'select public.discard_finance_accountability_draft($1,$2::timestamptz) as discarded',
      [report.id, version],
    ));

  await assert.rejects(discard('anon', null, first), { code: '42501' });
  await assert.rejects(discard('authenticated', ids.outsider, first), { code: '42501' });
  await assert.rejects(discard('authenticated', ids.operator, first, '2000-01-01T00:00:00Z'), { code: '40001' });
  assert.equal((await discard('authenticated', ids.operator, first)).rows[0].discarded, true);
  assert.equal((await db.query('select status from public.finance_accountability_reports where id = $1', [first.id])).rows[0].status, 'archived');
  assert.deepEqual((await db.query(
    'select action from public.finance_accountability_history where report_id=$1 order by id',
    [first.id],
  )).rows.map(row => row.action), ['created', 'archived']);
  const archivedVersion = (await db.query('select updated_at::text from public.finance_accountability_reports where id=$1', [first.id])).rows[0].updated_at;
  await assert.rejects(discard('authenticated', ids.operator, first, archivedVersion), { code: '22023' });

  const second = (await create('Rascunho com conteúdo real')).rows[0];
  await asRole(db, 'authenticated', ids.operator, () => db.query(
    'update public.finance_accountability_reports set financial_data=$1::jsonb where id=$2',
    [JSON.stringify({ finance: 'preserve' }), second.id],
  ));
  const updated = (await db.query('select updated_at::text from public.finance_accountability_reports where id=$1', [second.id])).rows[0];
  await assert.rejects(discard('authenticated', ids.operator, second, updated.updated_at), { code: '22023' });
  assert.equal((await db.query('select status from public.finance_accountability_reports where id=$1', [second.id])).rows[0].status, 'draft');
});
