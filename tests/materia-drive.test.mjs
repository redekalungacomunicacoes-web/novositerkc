import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const dataUrl=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const google=dataUrl(`export const ensureDrivePath=async(root,segments)=>{globalThis.materiaDrive.events.push(['folder',root,...segments]);return {folderId:'operational-folder'};};export const uploadDriveFile=async(file,folder)=>{const id='physical-file-'+(++globalThis.materiaDrive.uploads);globalThis.materiaDrive.events.push(['upload',file.type,folder]);return {id,name:file.name,size:file.size};};export const trashDriveFile=async(id)=>globalThis.materiaDrive.events.push(['trash',id]);`);
globalThis.Deno={env:{get:()=> 'https://supabase-fixture'}};
const source=(await readFile('supabase/functions/_shared/materia-drive.ts','utf8')).replace('"./google-drive.ts"',JSON.stringify(google));
const helper=await import(dataUrl(source));
const member='7a8539bf-f5f3-412f-bf30-17cf669e9129';
function fixture(canRead=true,failInsert=false){globalThis.materiaDrive={events:[],uploads:0};const admin={from:()=>({insert:rows=>({select:async()=>failInsert?{data:null,error:new Error('db failed')}:{data:(Array.isArray(rows)?rows:[rows]).map((row,index)=>({...row,id:'metadata-id-'+index})),error:null}})})};const user={rpc:async()=>({data:true,error:null}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>canRead?{data:{id:member,slug:'materia-piloto',status:'published'}}:{data:null,error:null}})})})};return {admin,user,events:globalThis.materiaDrive.events};}
function form(type='image/jpeg',bytes=[0xff,0xd8,0xff,0,0]){const f=new FormData();f.set('materia_id',member);f.set('category','content');f.set('file',new File([new Uint8Array(bytes)],'imagem.jpg',{type}));return f;}
test('requires permission to read article before touching Drive',async()=>{const f=fixture(false);await assert.rejects(()=>helper.uploadMateriaDrive(form(), '1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD',f.user,f.admin,'actor'),/Sem permissão/);assert.deepEqual(f.events,[]);});
test('rejects unsupported or mislabeled images before upload',async()=>{const f=fixture();await assert.rejects(()=>helper.uploadMateriaDrive(form('image/jpeg',[137,80,78,71,13,10,26,10]),'1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD',f.user,f.admin,'actor'),/conteúdo do arquivo/);assert.equal(f.events.length,0);});
test('uploads to the institutional article folder and records a public Drive reference',async()=>{const f=fixture();const result=await helper.uploadMateriaDrive(form(),'1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD',f.user,f.admin,'actor');assert.equal(result.drive_file_id,'physical-file-1');assert.equal(result.module,'materias');assert.equal(result.category,'content');assert.match(result.url,/drive-media\?id=materia-/);assert.deepEqual(f.events.slice(0,2),[['folder','1cwfy1GybdqWd7Uv6MABFFIqpN3LMlMGL','materia-piloto','IMAGENS'],['upload','image/jpeg','operational-folder']]);});
test('uploads optimized cover and WebP thumbnail together',async()=>{const f=fixture();const data=form();data.set('category','cover');data.set('thumbnail',new File([new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])],'capa-thumb.webp',{type:'image/webp'}));const result=await helper.uploadMateriaDrive(data,'1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD',f.user,f.admin,'actor');assert.equal(result.drive_file_id,'physical-file-1');assert.equal(result.category,'cover');assert.equal(result.thumbnail.drive_file_id,'physical-file-2');assert.equal(result.thumbnail.category,'cover_thumb');assert.equal(f.events.filter(e=>e[0]==='upload').length,2);});
test('trashes physical upload if metadata linking fails',async()=>{const f=fixture(true,true);await assert.rejects(()=>helper.uploadMateriaDrive(form(),'1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD',f.user,f.admin,'actor'),/db failed/);assert.deepEqual(f.events.map(e=>e[0]),['folder','upload','trash']);});
test('archives and trashes only unreferenced article files',async()=>{
  const f=fixture();const updates=[];
  const liveMeta='00000000-0000-4000-8000-000000000011',oldMeta='00000000-0000-4000-8000-000000000012';
  const article={id:member,capa_drive_file_id:liveMeta,capa_thumb_drive_file_id:null,banner_drive_file_id:null,audio_drive_file_id:null,content_blocks:[{drive_file_id:liveMeta}]};
  const rows=[{id:liveMeta,drive_file_id:'physical-live',status:'active'},{id:oldMeta,drive_file_id:'physical-old',status:'active'}];
  const query=()=>{let ids=null;const q={eq:()=>q,not:()=>q,in:(column,values)=>{if(column==='id')ids=new Set(values);return q;},is:async()=>({data:ids?rows.filter(row=>ids.has(row.id)):rows,error:null}),maybeSingle:async()=>({data:article,error:null})};return q;};
  const admin={from:()=>({select:query,update:values=>({eq:async(_,id)=>{updates.push({id,...values});return {error:null};}})})};
  const user={rpc:async()=>({data:true,error:null}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:member},error:null})})})})};
  const result=await helper.cleanupUnreferencedMateriaFiles(member,[oldMeta],user,admin);
  assert.deepEqual(result,{retained:0,archived:1,trashed:1,pending:0});
  assert.deepEqual(updates.map(x=>[x.id,x.status]),[[oldMeta,'archived'],[oldMeta,'trashed']]);
  assert.ok(f.events.some(e=>e[0]==='trash'&&e[1]==='physical-old'));
  assert.ok(!f.events.some(e=>e[0]==='trash'&&e[1]==='physical-live'));
});

for (const operation of ['upload', 'cleanup']) {
  test(`${operation} rejects a public reader before touching Drive`, async () => {
    const f = fixture();
    f.user.rpc = async () => ({ data: false, error: null });
    const action = operation === 'upload'
      ? () => helper.uploadMateriaDrive(form(), '1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD', f.user, f.admin, 'actor')
      : () => helper.cleanupUnreferencedMateriaFiles(member, [], f.user, f.admin);
    await assert.rejects(action, /Sem permissão editorial/);
    assert.deepEqual(f.events, []);
  });
}
