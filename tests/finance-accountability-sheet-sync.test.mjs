import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import {
  a1, applyFajCells, fajEditableCells, fajFormulaCorrections, fajTabs, readFajCells,
} from '../supabase/functions/_shared/faj-sheet-mapping.ts';
import { reconcileCells } from '../supabase/functions/_shared/accountability-sheet-reconcile.ts';

test('official cell map excludes static notes, duplicate fields and protected formulas', () => {
  const keys = fajEditableCells.map(a1);
  assert.equal(new Set(keys).size, keys.length);
  assert(!keys.includes(`'${fajTabs[1]}'!A16`));
  assert(!keys.includes(`'${fajTabs[4]}'!B3`));
  assert(fajFormulaCorrections.every(cell => !keys.includes(a1(cell))));
  const original = {
    financial_data: { workPlan: 'Legacy', funding: [{ amount: 200, externalId: 'x' }] },
    narrative_data: { question_1: 'Keep' },
  };
  const values = {
    [`'${fajTabs[2]}'!F3`]: 0,
    [`'${fajTabs[2]}'!H3`]: 46023,
    [`'${fajTabs[1]}'!A15`]: 'End of official table',
    [`'${fajTabs[0]}'!B5`]: 'a@example.test; b@example.test',
  };
  const updated = applyFajCells(original, values);
  assert.equal(updated.financial_data.workPlan, 'Legacy');
  assert.equal(updated.financial_data.workPlanRows.length, 13);
  assert.equal(updated.financial_data.workPlanRows[12].objective, 'End of official table');
  assert.equal(updated.financial_data.funding[0].externalId, 'x');
  assert.equal(updated.narrative_data.question_1, 'Keep');
  assert.deepEqual(updated.narrative_data.institution.emails, ['a@example.test', 'b@example.test']);
  assert.equal(readFajCells(updated)[`'${fajTabs[2]}'!F3`], 0);
  assert.match(updated.financial_data.funding[0].expectedDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.throws(() => applyFajCells(original, { [`'${fajTabs[2]}'!F3`]: '1000,50' }));
});

test('reconciles independent panel and sheet edits, then detects a same-cell conflict', () => {
  const amount = `'${fajTabs[2]}'!F3`;
  const source = `'${fajTabs[2]}'!A3`;
  const blank = { financial_data: {}, narrative_data: {} };
  const baseline = readFajCells(blank);
  const panel = readFajCells(applyFajCells(blank, { [amount]: 0 }));
  const sheet = readFajCells(applyFajCells(blank, { [source]: 'Provider' }));
  const compatible = reconcileCells(baseline, panel, sheet, Object.keys(baseline));
  assert.deepEqual({ ...compatible.toPanel }, { [source]: 'Provider' });
  assert.deepEqual({ ...compatible.toSheet }, { [amount]: 0 });
  const discordant = reconcileCells(baseline, panel, { ...sheet, [amount]: 120 }, Object.keys(baseline));
  assert.deepEqual(discordant.conflicts, [{ key: amount, base: null, panel: 0, sheet: 120 }]);
});

const migrationNames = [
  '20261124090000_finance_accountability_templates.sql',
  '20261124190000_finance_accountability_edit_history.sql',
  '20261124201000_finance_accountability_sheet_sync.sql',
];
const migrations = await Promise.all(migrationNames.map(name =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));

test('only service can checkpoint and pull, and stale or approved drafts remain intact', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    create table public.finance_funds(id uuid primary key);
    create table public.finance_projects(id uuid primary key);
    create table public.roles(id uuid primary key default gen_random_uuid(), name text);
    create table public.user_roles(user_id uuid, role_id uuid);
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
  `);
  for (const migration of migrations) await db.exec(migration);

  const user = '11111111-1111-4111-8111-111111111111';
  const report = '22222222-2222-4222-8222-222222222222';
  const spreadsheet = 'validated_sheet_id';
  await db.exec(`
    grant usage on schema public, auth to service_role;
    grant select, update on public.finance_accountability_reports to service_role;
    grant insert, select on public.finance_accountability_history to service_role;
    insert into auth.users values ('${user}');
    insert into finance_reporting_templates(slug,name) values ('test','test');
    insert into finance_accountability_reports(id,template_id,title)
      select '${report}',id,'test' from finance_reporting_templates;
    insert into finance_accountability_sheet_sync(report_id,spreadsheet_id) values ('${report}','${spreadsheet}');
  `);
  const complete = (expected = {}, actual = { budgetExcludingTeam: [{ total: 12 }] }) => db.query(
    'select complete_finance_accountability_sheet_sync($1,$2,$3,$4,$5,$6,$7,$8,$9) as ok',
    [report, spreadsheet, user, {}, expected, {}, actual, { field: 12 }, { field: { from: null, to: 12, direction: 'panel' } }],
  );

  await db.exec('set role authenticated');
  await assert.rejects(complete(), /permission denied/);
  await assert.rejects(db.query('select * from finance_accountability_sheet_sync'), /permission denied/);
  await db.exec('reset role; set role service_role');
  assert.equal((await complete()).rows[0].ok, true);
  assert.equal((await complete()).rows[0].ok, false);
  await db.exec('reset role');

  const audit = await db.query("select actor_id, snapshot from finance_accountability_history where snapshot->>'origin' = 'google_sheets'");
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].actor_id, user);
  assert.equal(audit.rows[0].snapshot.changes.field.to, 12);
  const state = await db.query('select status,baseline from finance_accountability_sheet_sync');
  assert.deepEqual(state.rows[0], { status: 'synced', baseline: { field: 12 } });

  await db.exec("update finance_accountability_reports set status = 'approved'; set role service_role;");
  assert.equal((await complete({ budgetExcludingTeam: [{ total: 12 }] }, {})).rows[0].ok, false);
  const saved = await db.query('select financial_data from finance_accountability_reports');
  assert.deepEqual(saved.rows[0].financial_data, { budgetExcludingTeam: [{ total: 12 }] });
});

test('Drive edge round-trip reads and writes official cells with mocked Google transport', async t => {
  const { syncAccountabilitySheet } = await import('../supabase/functions/_shared/accountability-sheets.ts');
  const reportId = '22222222-2222-4222-8222-222222222222';
  const actor = '11111111-1111-4111-8111-111111111111';
  const spreadsheet = 'individual_sheet_id';
  const report = { id: reportId, status: 'draft', template_id: 'FAJ-v1', drive_folder_id: 'reportFolder', financial_data: {}, narrative_data: {} };
  const state = { spreadsheet_id: spreadsheet, status: 'pending', baseline: readFajCells(report), conflicts: [], conflict_token: null, error: null, last_synced_at: null };
  const writes = [];
  const cells = Object.fromEntries(fajTabs.map(tab => [tab, {}]));
  const [,, funding, team, budget] = fajTabs;
  const add = (tab, col, row, value) => {
    cells[tab][`${col}${row}`] = { ...cells[tab][`${col}${row}`], ...value };
  };
  const mark = (tab, refs, property) => {
    for (const ref of refs) {
      const [_, col, row] = /^([A-Z])(\d+)$/.exec(ref);
      add(tab, col, row, property);
    }
  };
  const refs = (first, last, cols) => Array.from({ length: last - first + 1 }, (_, i) =>
    cols.map(col => `${col}${first + i}`)).flat();
  const formula = { userEnteredValue: { formulaValue: '=0' } };
  mark(funding, refs(22, 26, ['B','C','D']), formula);
  mark(team, [...refs(2, 17, ['F','H']), ...refs(18, 18, ['F','G','H']), ...refs(22, 26, ['C'])], formula);
  mark(budget, [...refs(7, 7, ['C','D']), ...refs(7, 17, ['E','F']), ...refs(18, 18, ['C','D','E','F']), ...refs(21, 23, ['B'])], formula);
  for (const { tab, row, column, formula: value } of fajFormulaCorrections) add(tab, String.fromCharCode(64 + column), row, { userEnteredValue: { formulaValue: value.replaceAll(',', ';') } });
  const validation = { dataValidation: { strict: true } };
  mark(funding, refs(3, 18, ['E','F','G']), validation);
  mark(team, refs(2, 17, ['C','D','E','G']), validation);
  mark(budget, refs(8, 17, ['C','D']), validation);
  const providerSnapshot = () => ({
    sheets: fajTabs.map((tab, sheetId) => ({
      properties: { title: tab, sheetId, hidden: tab === 'LISTAS' },
      protectedRanges: [{
        description: 'RKC · campos oficiais e fórmulas', range: { sheetId },
        unprotectedRanges: fajEditableCells.filter(cell => cell.tab === tab).map(({ row, column }) => ({
          sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: column - 1, endColumnIndex: column,
        })),
      }],
      data: [{ rowData: Array.from({ length: 30 }, (_, row) => ({
        values: Array.from({ length: 9 }, (_, col) => cells[tab][`${String.fromCharCode(65 + col)}${row + 1}`] || {}),
      })) }],
    })),
  });
  const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  const originalDeno = globalThis.Deno;
  globalThis.Deno = { env: { get: () => 'fixture' } };
  t.after(() => { if (originalDeno === undefined) delete globalThis.Deno; else globalThis.Deno = originalDeno; });
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    if (url.hostname === 'oauth2.googleapis.com') return json({ access_token: 'test-provider-token' });
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-provider-token');
    if (url.hostname === 'sheets.googleapis.com') {
      assert.match(url.pathname, new RegExp(spreadsheet));
      if (url.pathname.endsWith(':batchUpdate')) {
        const { requests } = JSON.parse(init.body);
        for (const { updateCells: edit } of requests) {
          const tab = fajTabs[edit.start.sheetId];
          const ref = a1({ tab, row: edit.start.rowIndex + 1, column: edit.start.columnIndex + 1 });
          assert.equal(edit.fields, 'userEnteredValue');
          assert(fajEditableCells.some(cell => a1(cell) === ref), `write to protected cell ${ref}`);
          const val = edit.rows[0].values[0].userEnteredValue;
          add(tab, String.fromCharCode(65 + edit.start.columnIndex), edit.start.rowIndex + 1, { userEnteredValue: val });
          writes.push({ ref, val });
        }
        return json({ replies: [] });
      }
      const fieldMask = url.searchParams.get('fields');
      assert.equal((fieldMask.match(/\(/g) ?? []).length, (fieldMask.match(/\)/g) ?? []).length);
      assert.equal(url.searchParams.getAll('ranges').length, fajTabs.length);
      return json(providerSnapshot());
    }
    assert.equal(url.hostname, 'www.googleapis.com');
    if (url.pathname.endsWith('/permissions')) return json({ permissions: [{ type: 'user' }] });
    if (url.pathname === '/drive/v3/files') {
      const query = url.searchParams.get('q');
      const match = { PRESTACOES_DE_CONTAS: 'restrictedReports', DOCUMENTOS_OFICIAIS: 'documentsFolder' };
      const name = Object.keys(match).find(key => query.includes(`name = '${key}'`));
      assert(name);
      return json({ files: [{ id: match[name], name }] });
    }
    const id = url.pathname.split('/').at(-1);
    if (id === spreadsheet) return json({ id, mimeType: 'application/vnd.google-apps.spreadsheet', parents: ['documentsFolder'] });
    if (id === 'reportFolder') return json({ id, mimeType: 'application/vnd.google-apps.folder', parents: ['restrictedReports'] });
    if (id === 'restrictedReports') return json({ id, mimeType: 'application/vnd.google-apps.folder', parents: ['financial_root'] });
    if (id === 'financial_root') return json({ id, name: 'RKC - FINANCEIRO PRIVADO', mimeType: 'application/vnd.google-apps.folder' });
    throw new Error(`Unexpected provider call to ${url.pathname}`);
  });

  const clone = value => structuredClone(value);
  function query(table) {
    let payload;
    const resolve = () => {
      if (table === 'task_drive_root_locks') return { data: { token: 'local-lock' }, error: null };
      if (table === 'finance_accountability_reports') return { data: clone(report), error: null };
      if (table === 'finance_accountability_sheet_sync') {
        if (payload) Object.assign(state, clone(payload));
        return { data: clone(state), error: null };
      }
      throw new Error(`Unexpected DB table ${table}`);
    };
    const wrapper = {
      select: () => wrapper, eq: () => wrapper, or: () => wrapper,
      upsert: () => wrapper, update: value => { payload = value; return wrapper; },
      maybeSingle: () => resolve(), then: next => Promise.resolve(resolve()).then(next),
    };
    return wrapper;
  }
  const user = { from: query, rpc: async name => {
    assert.equal(name, 'can_manage_finance_accountability');
    return { data: true };
  } };
  const admin = { from: query, rpc: async (name, values) => {
    assert.equal(name, 'complete_finance_accountability_sheet_sync');
    assert.deepEqual(values.p_expected_financial, report.financial_data);
    report.financial_data = clone(values.p_next_financial);
    report.narrative_data = clone(values.p_next_narrative);
    Object.assign(state, { status: 'synced', baseline: clone(values.p_baseline), conflicts: [], conflict_token: null });
    return { data: true };
  } };
  const run = options => syncAccountabilitySheet(reportId, 'financial_root', user, admin, actor, options);
  const amount = `'${funding}'!F3`;
  report.financial_data = { funding: [{ amount: 0 }] };
  add(funding, 'A', 3, { userEnteredValue: { stringValue: 'Financiador de teste' } });
  const first = await run();
  assert.equal(first.sync.status, 'synced', first.sync.error);
  assert.equal(first.pulled, true);
  assert.deepEqual(writes, [{ ref: amount, val: { numberValue: 0 } }]);
  assert.equal(report.financial_data.funding[0].source, 'Financiador de teste');

  report.financial_data.funding[0].amount = 12;
  add(funding, 'F', 3, { userEnteredValue: { numberValue: 20 } });
  const conflict = await run();
  assert.equal(conflict.sync.status, 'conflict', conflict.sync.error);
  assert.equal(conflict.sync.conflict_count, 1);
  assert.equal(writes.length, 1);
  const stale = await run({ resolution: 'sheet', conflictToken: 'not-the-current-conflict' });
  assert.equal(stale.sync.status, 'conflict');
  assert.equal(report.financial_data.funding[0].amount, 12);
  const resolved = await run({ resolution: 'sheet', conflictToken: conflict.sync.conflict_token });
  assert.equal(resolved.sync.status, 'synced', resolved.sync.error);
  assert.equal(resolved.pulled, true);
  assert.equal(report.financial_data.funding[0].amount, 20);
  assert.equal(writes.length, 1);
});
