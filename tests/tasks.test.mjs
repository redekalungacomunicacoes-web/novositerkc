import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const url = (source) => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
const driveStub = url(`export async function ensureDrivePath(root, path) { return globalThis.folderFixture(root,path); } export async function trashDriveFile(id) { return globalThis.trashFixture(id); }`);
const taskDrive = url((await readFile('supabase/functions/_shared/task-drive.ts','utf8')).replace('"./google-drive.ts"', JSON.stringify(driveStub)));
const { prepareTaskFolder } = await import(taskDrive);
const { deleteTaskAndQueueCleanup, retryTaskCleanup } = await import(url((await readFile('supabase/functions/_shared/task-delete.ts','utf8')).replace('"./google-drive.ts"', JSON.stringify(driveStub)).replace('"./task-drive.ts"', JSON.stringify(taskDrive))));
function fixture({ forbidden = false, deleteZero = false, driveFail = false } = {}) {
 const task = { id:'task-12345678', titulo:'Teste', created_by:'creator', assigned_to:'someone-else', drive_folder_id:null };
 const state = { task, job:null, lock:null, files:[{ id:'file-row', drive_file_id:'physical-file', uploaded_by:'other-user' }], legacy:[{file_url:'https://example.org'},{file_url:'task/old.pdf'}], trashed:[], paths:[] };
 globalThis.folderFixture = async (root,path) => { state.path=path; return {folderId:'folder'}; };
 globalThis.trashFixture = async (id) => { if(driveFail) throw new Error('Drive offline'); state.trashed.push(id); };
 const client = (user=false) => ({
   rpc: async () => ({data:false,error:null}),
   storage:{from:()=>({remove:async paths=>{state.paths.push(...paths);return {error:null};}})},
   from(table) {
     let action='read', value, token;
     const builder = new Proxy({}, { get(_,key) {
       if(key==='then') return (resolve,reject) => Promise.resolve(run()).then(resolve,reject);
       return (...args)=>{ if(['update','upsert','delete','insert'].includes(key)){ action=key;value=args[0]; }
         if(key==='eq' && args[0]==='token') token=args[1];
         return builder;
       };
     }});
     function run() {
       if(table==='tasks') { if(action==='delete') { if(deleteZero) return {data:null,error:null}; const id=state.task?.id;state.task=null;return {data:id?{id}:null,error:null}; }
         if(action==='update') Object.assign(state.task,value);
         return {data:state.task,error:null}; }
       if(table==='equipe') return {data:{id:'creator',nome:'Criador logado',user_id:forbidden?'another-user':'auth-user'},error:null};
       if(table==='drive_files') { if(action==='update')return {error:null};return {data:state.files,error:null}; }
       if(table==='task_attachments')return {data:state.legacy,error:null};
       if(table==='task_drive_locks'){ if(action==='upsert')state.lock=value;if(action==='update')Object.assign(state.lock,value);if(action==='delete' && state.lock?.token===token)state.lock=null;return {data:state.lock,error:null}; }
       if(table==='task_drive_root_locks'){if(action==='upsert')state.root=value;if(action==='update')Object.assign(state.root,value);return {data:state.root,error:null};}
       if(table==='task_cleanup_jobs'){if(action==='upsert')state.job=value;if(action==='update')Object.assign(state.job,value);return {data:state.job,error:null};}
       throw new Error(table);
     }
     return builder;
   }
 });
 return {state,admin:client(),user:client(true)};
}
test('folder belongs to creator even when assigned to someone else; reuse persisted ID',async()=>{
 const f=fixture();assert.equal(await prepareTaskFolder(f.state.task.id,'root',f.admin),'folder');
 assert.deepEqual(f.state.path,['04_EQUIPE','Criador logado','TAREFAS','Teste - task-123']);
 globalThis.folderFixture=()=>{throw new Error('must not recreate');};
 assert.equal(await prepareTaskFolder(f.state.task.id,'root',f.admin),'folder');assert.equal(f.state.lock,null);
});
test('unauthorized delete never touches files or creates a cleanup job',async()=>{
 const f=fixture({forbidden:true});await assert.rejects(deleteTaskAndQueueCleanup(f.state.task.id,f.user,f.admin,'auth-user'),/Somente/);
 assert.equal(f.state.job,null);assert.deepEqual(f.state.trashed,[]);assert.ok(f.state.task);
});
test('zero deleted rows never cleans physical files, including retries',async()=>{
 const f=fixture({deleteZero:true});await assert.rejects(deleteTaskAndQueueCleanup(f.state.task.id,f.user,f.admin,'auth-user'),/confirmada/);
 await assert.rejects(retryTaskCleanup(f.state.task.id,f.user,f.admin,'auth-user'),/ainda existe/);assert.deepEqual(f.state.trashed,[]);
});
test('delete cleans files from other participants, folder and legacy storage',async()=>{
 const f=fixture();f.state.task.drive_folder_id='folder';const result=await deleteTaskAndQueueCleanup(f.state.task.id,f.user,f.admin,'auth-user');
 assert.equal(result.cleanup_pending,false);assert.equal(f.state.task,null);assert.equal(f.state.job.status,'done');
 assert.deepEqual(f.state.trashed,['physical-file','folder']);assert.deepEqual(f.state.paths,['task/old.pdf']);
});
test('Drive outage preserves durable cleanup job after confirmed deletion; retry works',async()=>{
 const f=fixture({driveFail:true});const result=await deleteTaskAndQueueCleanup(f.state.task.id,f.user,f.admin,'auth-user');
 assert.equal(result.cleanup_pending,true);assert.equal(f.state.task,null);assert.equal(f.state.job.status,'pending');
 globalThis.trashFixture=async id=>f.state.trashed.push(id);
 assert.equal((await retryTaskCleanup(result.task_id,f.user,f.admin,'auth-user')).cleanup_pending,false);
});
test('migration enforces creator, visibility, deletion and comments under authenticated RLS',async()=>{
 const db = new PGlite();
 const own='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002';
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_team_admin() returns boolean language sql as $$select false$$;
 create table equipe(id uuid primary key,user_id uuid,nome text,ativo boolean);
 create table tasks(id uuid primary key default gen_random_uuid(),titulo text,created_by uuid references equipe(id),assigned_to uuid,drive_folder_id text);
 create table task_assignees(task_id uuid references tasks(id) on delete cascade,user_id uuid references equipe(id));
 create table drive_files(id uuid primary key,module text,task_id uuid,visibility text);
 alter table tasks enable row level security;alter table drive_files enable row level security;alter table task_assignees enable row level security;
 create policy old_read on tasks for select to authenticated using(true);create policy old_insert on tasks for insert to authenticated with check(true);
 create policy old_update on tasks for update to authenticated using(true) with check(true);
 create policy old_drive on drive_files for select to authenticated using(true);
 create policy old_assignees on task_assignees for all to authenticated using(true) with check(true);
 grant usage on schema public,auth to authenticated;grant all on equipe,tasks,task_assignees,drive_files to authenticated;
 insert into equipe values('${own}','${own}','Own',true),('${other}','${other}','Other',true);
 insert into tasks(id,titulo,created_by,assigned_to) values('${own}','Own','${own}','${other}'),('${other}','Other','${other}','${other}');`);
 await db.exec(await readFile('supabase/migrations/20261002040710_tasks_lifecycle_repair.sql','utf8'));
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${own}',false);`);
 assert.equal((await db.query('select * from tasks')).rows.length,1);
 await assert.rejects(db.query(`insert into tasks(titulo,created_by) values('forged','${other}')`),/row-level security/);
 await assert.rejects(db.query(`update tasks set created_by='${other}' where id='${own}'`),/criador/);
 await db.query(`insert into task_comments(task_id,author_id,comentario) values('${own}','${own}','Comentário')`);
 await assert.rejects(db.query(`insert into task_comments(task_id,author_id,comentario) values('${own}','${other}','forged')`),/row-level security/);
 assert.equal((await db.query(`delete from tasks where id='${other}' returning id`)).rows.length,0);
 assert.equal((await db.query(`delete from tasks where id='${own}' returning id`)).rows.length,1);
 assert.equal((await db.query('select * from task_comments')).rows.length,0);
 await assert.rejects(db.query('select * from task_cleanup_jobs'),/permission denied/);
 await db.close();
});
