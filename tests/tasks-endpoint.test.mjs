import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const google=dataUrl(`
export async function uploadDriveFile(file,folder){ return globalThis.uploadFixture(file,folder); }
export async function trashDriveFile(id){ globalThis.trashed.push(id); }
export const downloadDriveFile=()=>{}, driveHealth=()=>{},ensureDrivePath=()=>{},renameDriveFile=()=>{},resolveAcademyFolder=()=>{},startDriveResumableUpload=()=>{},getDriveFileMetadata=()=>{},assertPrivateDriveFile=()=>{};
`);
let handler;
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://fixture',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service',GOOGLE_DRIVE_ROOT_FOLDER_ID:'root'})[key]},serve:fn=>{handler=fn;}};
let source=await readFile('supabase/functions/drive-files/index.ts','utf8');
source=source.replace('"https://esm.sh/@supabase/supabase-js@2"',JSON.stringify(dataUrl('export const createClient=(url,key)=>globalThis.endpointClient(key);')))
 .replace('"../_shared/cors.ts"',JSON.stringify(dataUrl('export const corsHeaders={};')))
 .replace('"../_shared/google-drive.ts"',JSON.stringify(google))
 .replace('"../_shared/file-center.ts"',JSON.stringify(dataUrl('export const createCenterFolder=()=>{},manageCenterFolder=()=>{},moveCenterFile=()=>{},uploadCenterFile=()=>{},withCenterLease=()=>{};')))
 .replace('"../_shared/task-drive.ts"',JSON.stringify(dataUrl('export async function prepareTaskFolder(){return "folder";}')))
 .replace('"../_shared/task-delete.ts"',JSON.stringify(dataUrl('export const deleteTaskAndQueueCleanup=()=>{},retryTaskCleanup=()=>{};')))
 .replace('"../_shared/academy-drive.ts"',JSON.stringify(dataUrl('export const uploadAcademyDrive=()=>{},prepareAcademyDestination=()=>{};')))
 .replace('"../_shared/team-drive.ts"',JSON.stringify(dataUrl('export const uploadTeamAvatar=()=>{},uploadTeamAvatarPair=()=>{},importLegacyTeamAvatar=()=>{};')));
await import(dataUrl(source));
const task='00000000-0000-0000-0000-000000000001', uploadId='00000000-0000-0000-0000-000000000002';
function fixture(race=false){
 let row=null,uploads=0;globalThis.trashed=[];
 globalThis.uploadFixture=async()=>({id:`physical-${++uploads}`,name:'anexo.txt',mimeType:'text/plain',size:'7'});
 globalThis.endpointClient=key=>({auth:{getUser:async()=>({data:{user:{id:'auth-user'}},error:null})},from(table){
 let operation='read',values;
 const b=new Proxy({}, {get(_,name){if(name==='then')return(resolve,reject)=>Promise.resolve(run()).then(resolve,reject);return(...args)=>{if(name==='insert'){operation='insert';values=args[0];}return b;};}});
 function run(){
  if(table==='tasks')return {data:{id:task},error:null};
  if(table==='drive_files'){
   if(operation==='insert'){
    if(race){row={...values,id:'winner',drive_file_id:'winner-file'};return {data:null,error:{code:'23505'}};}
    row={...values,id:'metadata'};
   }
   return {data:row,error:null};
  }
  throw new Error(table);
 }
 return b;
 }});
 return {uploads:()=>uploads};
}
async function request(){const body=new FormData();body.append('module','tasks');body.append('task_id',task);body.append('upload_id',uploadId);body.append('file',new File(['Arquivo'],'anexo.txt',{type:'text/plain'}));return handler(new Request('https://fixture/drive-files',{method:'POST',body,headers:{Authorization:'Bearer fixture'}}));}
test('task HTTP upload returns previous metadata when response is retried; never uploads twice',async()=>{
 const f=fixture();const first=await request(),second=await request();assert.equal(first.status,200);assert.equal(second.status,200);
 assert.equal((await first.json()).file.id,(await second.json()).file.id);assert.equal(f.uploads(),1);assert.deepEqual(globalThis.trashed,[]);
});
test('concurrent task upload unique conflict trashes the orphan and returns the winning metadata',async()=>{
 const f=fixture(true);const result=await request();assert.equal(result.status,200);assert.equal((await result.json()).file.id,'winner');assert.equal(f.uploads(),1);assert.deepEqual(globalThis.trashed,['physical-1']);
});
