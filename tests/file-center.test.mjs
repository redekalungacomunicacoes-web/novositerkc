import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const url=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const google=url(`
export const createDriveFolder=(...a)=>globalThis.createPhysical(...a);
export const ensureDrivePath=async()=>({folderId:"root-parent"});
export const getDriveFileMetadata=async()=>({id:"physical",parents:["old-folder"]});
export const listDriveChildren=async()=>({files:globalThis.children});
export const moveDriveFile=async(...a)=>{globalThis.moves.push(a);};
export const renameDriveFile=async()=>{},trashDriveFile=async id=>{globalThis.trashes.push(id);},uploadDriveFile=async()=>{};
`);
const source=(await readFile('supabase/functions/_shared/file-center.ts','utf8')).replace('"./google-drive.ts"',JSON.stringify(google)).replace('"./task-drive.ts"',JSON.stringify(url('export const prepareTaskFolder=async()=> "task-folder";')));
const {cleanFolderName,moveCenterFile,manageCenterFolder,createCenterFolder}=await import(url(source));
function client(responses,role=false){
 return {rpc:async()=>({data:role,error:null}),from(table){
  const b=new Proxy({}, {get(_,key){if(key==='then')return(resolve,reject)=>Promise.resolve(responses.shift()).then(resolve,reject);return()=>b;}});return b;
 }};
}
test('folder names preserve task titles and reject empty names',()=>{assert.equal(cleanFolderName(' Cobertura da Romaria '),'Cobertura da Romaria');assert.throws(()=>cleanFolderName(' '));});
test('move is authorized before changing physical parents',async()=>{
 globalThis.moves=[];
 const user=client([{data:{id:'f',module:'tasks',uploaded_by:'other',drive_folder_id:'old-folder',drive_file_id:'physical'}}]);
 await assert.rejects(moveCenterFile({id:'f',task_id:'task'},'root',user,client([]),'me'),/Somente/);
 assert.deepEqual(globalThis.moves,[]);
});
test('move changes task association and rolls back physical move if database rejects',async()=>{
 globalThis.moves=[];
 const file={id:'f',module:'tasks',uploaded_by:'me',drive_folder_id:'old-folder',drive_file_id:'physical'};
 const user=client([{data:file},{data:{id:'task'}}]);
 await assert.rejects(moveCenterFile({id:'f',task_id:'task'},'root',user,client([{error:new Error('DB offline')}]),'me'),/DB offline/);
 assert.deepEqual(globalThis.moves,[['physical','task-folder','old-folder'],['physical','old-folder','task-folder']]);
});
test('nonempty folders never go to trash, including untracked Drive files',async()=>{
 globalThis.children=[{id:'outside-site'}];globalThis.trashes=[];
 const user=client([{data:{id:'folder',owner_user_id:'me',drive_folder_id:'physical-folder'}}]);
 await assert.rejects(manageCenterFolder({id:'folder',action:'center-folder-delete'},user,client([]),'me'),/contém/);assert.deepEqual(globalThis.trashes,[]);
});
test('failed folder registration cleans only the folder just created',async()=>{
 globalThis.createPhysical=async()=>({id:'new-folder'});globalThis.trashes=[];
 const admin=client([{data:{id:'member',nome:'Equipe'}},{data:null},{error:new Error('DB offline')}]);
 await assert.rejects(createCenterFolder({name:'Cobertura'},'root',client([]),admin,'me'),/DB offline/);
 assert.deepEqual(globalThis.trashes,['new-folder']);
});
test('standalone files are private to owner and direct client folder writes are denied',async()=>{
 const db=new PGlite(),own='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_team_admin() returns boolean language sql as $$select false$$;
 create table public.drive_files(id uuid primary key,module text,uploaded_by uuid,status text);
 alter table drive_files enable row level security;
 create policy old_read on drive_files for select to authenticated using(true);
 create policy old_public on drive_files for select to anon using(true);
 grant usage on schema auth,public to authenticated,anon;grant select on drive_files to authenticated,anon;
 insert into drive_files values('${own}','file-center','${own}','active'),('${other}','file-center','${other}','active');`);
 await db.exec(await readFile('supabase/migrations/20261002053000_file_center.sql','utf8'));
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${own}',false);`);
 assert.equal((await db.query('select * from drive_files')).rows.length,1);
 await assert.rejects(db.query(`insert into file_center_folders(owner_user_id,name,drive_folder_id) values('${own}','fake','fake')`),/permission denied/);
 await db.exec('reset role;set role anon;');assert.equal((await db.query('select * from drive_files')).rows.length,0);
 await db.close();
});
