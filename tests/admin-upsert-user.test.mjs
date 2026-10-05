import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
let handler;
globalThis.Deno={env:{get:()=> 'configured'},serve:fn=>{handler=fn;}};
const mock='data:text/javascript;base64,'+Buffer.from('export const createClient=()=>globalThis.upsertFixture;').toString('base64');
const source=(await readFile('supabase/functions/admin-upsert-user/index.ts','utf8')).replace('"https://esm.sh/@supabase/supabase-js@2"',JSON.stringify(mock));
await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
function fixture(role='admin_alfa') {
 const updates=[];
 globalThis.upsertFixture={auth:{getUser:async()=>({data:{user:{id:'caller'}}}),admin:{listUsers:async()=>({data:{users:[{id:'existing',email:'member@example.org'}]}}),updateUserById:async(id,payload)=>{updates.push({id,payload});return {};},createUser:async()=>{throw Error('must not create duplicate');}}},from(table){let op='select',filters={};const b=new Proxy({}, {get(_,key){if(key==='then') return resolve=>resolve(run());return(...args)=>{if(['insert','update','delete'].includes(key))op=key;if(key==='eq')filters[args[0]]=args[1];return b;};}});function run(){if(table==='equipe')return {data:filters.id==='member'?{id:'member',user_id:'existing'}:null};if(table==='roles')return {data:[{id:'role',name:'autor'}]};if(table==='user_roles')return {data:op==='select'?[{roles:{name:filters.user_id==='caller'?role:'autor'}}]:null};throw Error(table);}return b;}};
 return updates;
}
const request=(token=true,roles=['autor'])=>new Request('https://example.org',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer session'}:{})},body:JSON.stringify({equipe_id:'member',email:'member@example.org',roles})});
test('unauthenticated caller cannot mutate Auth',async()=>{const updates=fixture();assert.equal((await handler(request(false))).status,401);assert.equal(updates.length,0);});
test('nonadmin caller cannot mutate Auth',async()=>{const updates=fixture('autor');assert.equal((await handler(request())).status,403);assert.equal(updates.length,0);});
test('existing login accepts omitted password and uses linked user ID',async()=>{const updates=fixture();assert.equal((await handler(request())).status,200);assert.equal(updates[0].id,'existing');assert.equal('password' in updates[0].payload,false);});
test('unknown permission is rejected before Auth updates',async()=>{const updates=fixture();assert.equal((await handler(request(true,['unknown']))).status,400);assert.equal(updates.length,0);});
