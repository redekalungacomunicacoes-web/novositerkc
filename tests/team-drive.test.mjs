import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const url = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const google=url(`export const ensureDrivePath=async(root,names)=>({folderId:root+'/'+names.join('/')});export const uploadDriveFile=async(file,folder)=>globalThis.teamFixture.upload(file,folder);export const trashDriveFile=async(id)=>globalThis.teamFixture.trashed.push(id);export const downloadDriveFile=async()=>new Response('different');`);
const source=(await readFile('supabase/functions/_shared/team-drive.ts','utf8')).replace('"./google-drive.ts"',JSON.stringify(google));
const team=await import(url(source));
const memberId='00000000-0000-0000-0000-000000000001';
const root='1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD';
function fixture({authorized=true,failThumb=false,failLink=false}={}) {
 const events=[],rows=[],trashed=[];let member={id:memberId,nome:'Teste',drive_folder_id:'member-folder',avatar_drive_file_id:null,avatar_thumb_drive_file_id:null};
 globalThis.teamFixture={trashed,upload:async(file,folder)=>{events.push('upload:'+file.name);if(failThumb && file.name.includes('thumb'))throw new Error('thumb failed');return {id:'physical-'+file.name,name:file.name,mimeType:file.type,size:file.size};}};
 const admin={from(table){let operation='read',values,filters=[];const b=new Proxy({}, {get(_,name){if(name==='then')return(resolve,reject)=>Promise.resolve(run()).then(resolve,reject);return(...args)=>{if(['insert','update','delete'].includes(name)){operation=name;values=args[0];}if(name==='eq')filters.push(args);return b;};}});function run(){
  if(table==='equipe') {if(operation==='update'){events.push('link');if(failLink)return {error:new Error('link failed')};member={...member,...values};}return {data:member,error:null};}
  if(table==='drive_files'){if(operation==='insert'){const row={...values,id:'row-'+rows.length};rows.push(row);return {data:row,error:null};}if(operation==='delete'){events.push('rollback');return {error:null};}return {data:rows,error:null};}
  throw new Error(table);
 }return b;}};
 const user={rpc:async()=>({data:authorized}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})}),auth:{getUser:async()=>({data:{user:{id:'other'}}})}};
 return {admin,user,events,rows,trashed,member:()=>member};
}
function form({badMime=false}={}) {
 const f=new FormData();f.set('member_id',memberId);
 f.set('avatar',new File([new Uint8Array([0x89,0x50,0x4e,0x47,1,2])],'source.png',{type:badMime?'image/jpeg':'image/png'}));
 f.set('thumb',new File(['RIFF0000WEBPcontent'],'thumb.webp',{type:'image/webp'}));return f;
}
test('unauthorized editor cannot upload or link files',async()=>{const f=fixture({authorized:false});await assert.rejects(team.uploadTeamAvatarPair(form(),root,f.user,f.admin,'actor'),/permissão/);assert.deepEqual(f.events,[]);});
test('invalid MIME is rejected before any Drive upload',async()=>{const f=fixture();await assert.rejects(team.uploadTeamAvatarPair(form({badMime:true}),root,f.user,f.admin,'actor'),/MIME/);assert.deepEqual(f.events,[]);});
test('pair links both files together and clears legacy fields only after both uploads',async()=>{const f=fixture();await team.uploadTeamAvatarPair(form(),root,f.user,f.admin,'actor');assert.deepEqual(f.events,['upload:avatar-original.png','upload:avatar-thumb.webp','link']);assert.equal(f.member().avatar_drive_file_id,'row-0');assert.equal(f.member().avatar_thumb_drive_file_id,'row-1');assert.equal(f.member().avatar_path,null);assert.equal(f.rows[0].mime_type,'image/png');});
test('thumbnail failure preserves previous member and rolls back staged original',async()=>{const f=fixture({failThumb:true});await assert.rejects(team.uploadTeamAvatarPair(form(),root,f.user,f.admin,'actor'),/thumb failed/);assert.equal(f.member().avatar_drive_file_id,null);assert.deepEqual(f.trashed,['physical-avatar-original.png']);});
test('link failure rolls back both staged files',async()=>{const f=fixture({failLink:true});await assert.rejects(team.uploadTeamAvatarPair(form(),root,f.user,f.admin,'actor'),/link failed/);assert.equal(f.member().avatar_drive_file_id,null);assert.deepEqual(f.trashed,['physical-avatar-thumb.webp','physical-avatar-original.png']);});
test('another Drive root cannot receive team files',async()=>{const f=fixture();await assert.rejects(team.ensureTeamMemberFolder(memberId,'play-root',f.user,f.admin),/institucional/);assert.deepEqual(f.events,[]);});
