import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const google = moduleUrl('export const ensureDrivePath=async()=>({folderId:"folder"});export const uploadDriveFile=async()=>{throw new Error("unexpected upload")};');
const lease = moduleUrl('export const withCenterLease=async(root,admin,work)=>work();');
const source = (await readFile('supabase/functions/_shared/site-drive.ts','utf8'))
  .replace('"./google-drive.ts"',JSON.stringify(google)).replace('"./file-center.ts"',JSON.stringify(lease));
const site = await import(moduleUrl(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText));
globalThis.Deno = { env: { get: () => 'https://test.supabase.co' } };
const root='1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD';
const user=authorized=>({rpc:async()=>({data:authorized})});
const form=(type='image/png',bytes=new Uint8Array([137,80,78,71,13,10,26,10,0]))=>{
 const data=new FormData();data.set('category','banner');data.set('file',new File([bytes],'banner.png',{type}));return data;
};
test('requires authorization before uploads or DB reads',async()=>{
 await assert.rejects(site.uploadSiteDrive(form(),root,user(false),{},'actor'),/permissão/);
});
test('rejects an unapproved root and destination',async()=>{
 await assert.rejects(site.uploadSiteDrive(form(),'other',user(true),{},'actor'),/institucional/);
 const data=form();data.set('category','private-documents');
 await assert.rejects(site.uploadSiteDrive(data,root,user(true),{},'actor'),/Destino/);
});
test('rejects forged MIME and SVG before uploading',async()=>{
 await assert.rejects(site.uploadSiteDrive(form('image/png',new TextEncoder().encode('<script>')),root,user(true),{},'actor'),/válida/);
 await assert.rejects(site.uploadSiteDrive(form('image/svg+xml'),root,user(true),{},'actor'),/válida/);
});
test('retry of identical content returns the same registered image without upload',async()=>{
 const previous={id:'registered',public_slug:'same-image'};
 const query=new Proxy({}, {get:(_,key)=>key==='maybeSingle'?async()=>({data:previous}):()=>query});
 const result=await site.uploadSiteDrive(form(),root,user(true),{from:()=>query},'actor');
 assert.equal(result.id,'registered');assert.equal(result.url,'https://test.supabase.co/functions/v1/drive-media?id=same-image');
});
test('ICO is limited to the favicon category',()=>{
 const ico=new Uint8Array([0,0,1,0]);
 assert.equal(site.validSiteImage(ico,'image/x-icon','favicon'),true);
 assert.equal(site.validSiteImage(ico,'image/x-icon','banner'),false);
});
test('logo/favicon resolver preserves Drive URLs and still supports old Storage paths',async()=>{
 const client=moduleUrl('export const supabase={storage:{from:bucket=>({getPublicUrl:path=>({data:{publicUrl:`storage://${bucket}/${path}`}})})}};');
 const uploader=moduleUrl('export const uploadSiteImage=async()=>"";');
 const footerSource=(await readFile('src/lib/footerSettings.ts','utf8')).replace('"@/lib/supabase"',JSON.stringify(client)).replace('"@/lib/siteDrive"',JSON.stringify(uploader));
 const footer=await import(moduleUrl(ts.transpileModule(footerSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText));
 const drive='https://test.supabase.co/functions/v1/drive-media?id=logo';
 assert.equal(footer.buildPublicStorageUrl(drive),drive);
 assert.equal(footer.buildPublicStorageUrl('footer/logo.png'),'storage://site-assets/footer/logo.png');
 assert.equal(footer.buildPublicStorageUrl(null),'');
});
