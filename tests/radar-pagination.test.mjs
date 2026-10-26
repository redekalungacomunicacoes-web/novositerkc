import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../supabase/functions/radar-editais/index.ts',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('const SCAN_BUDGET_MS'),source.indexOf('Deno.serve')).replace('export async function','async function');
const context=vm.createContext({URL,Date,Set,JSON,Number,Math,Error,TypeError,AbortSignal,fetch,setTimeout});
vm.runInContext(stripTypeScriptTypes(helper)+';globalThis.collect=collectPages',context);
const collect=context.collect;
const body=(page,total,data=[{numeroControlePNCP:`record-${page}`}])=>new Response(JSON.stringify({data,totalPaginas:total,numeroPagina:page}));
test('reads all pages beyond two and consumes each exactly once',async()=>{
 const pages=[]; const consumed=[];
 const r=await collect(6,Date.now()+120000,async data=>consumed.push(...data),async url=>{const p=Number(url.searchParams.get('pagina'));pages.push(p);return body(p,5)});
 assert.equal(r.completa,true);assert.deepEqual(pages,[1,2,3,4,5]);assert.equal(consumed.length,5);
});
test('204 is a successful empty modality',async()=>assert.equal((await collect(1,Date.now()+120000,async()=>{},async()=>new Response(null,{status:204}))).completa,true));
test('failure identifies modality and exact unfinished page',async()=>{
 const r=await collect(8,Date.now()+120000,async()=>{},async url=>Number(url.searchParams.get('pagina'))===1?body(1,4):new Response('',{status:400}));
 assert.equal(r.completa,false);assert.equal(r.paginas,1);assert.match(r.erro,/modalidade 8, página 2.*HTTP 400/);
});
test('transient failures are retried without consuming twice',async()=>{
 let attempts=0,consumed=0;
 const r=await collect(9,Date.now()+120000,async()=>consumed++,async()=>++attempts===1?new Response('',{status:503}):body(1,1));
 assert.equal(r.completa,true);assert.equal(attempts,2);assert.equal(consumed,1);
});
test('deadline stops requests and reports partial result',async()=>{
 const r=await collect(12,10,async()=>assert.fail(),async()=>assert.fail(),()=>11);
 assert.equal(r.completa,false);assert.match(r.erro,/Limite de tempo/);
});
test('invalid metadata, repeated and premature empty pages fail',async()=>{
 for(const response of [()=>new Response(JSON.stringify({data:[]})),()=>body(1,2,[])]) {
  assert.equal((await collect(6,Date.now()+120000,async()=>{},response)).completa,false);
 }
 const r=await collect(6,Date.now()+120000,async()=>{},async url=>body(Number(url.searchParams.get('pagina')),3,[{numeroControlePNCP:'same'}]));
 assert.equal(r.paginas,1);assert.match(r.erro,/Página repetida/);
});
test('persistence is insert-only and authorization remains enabled in handler',()=>{
 assert.match(source,/ignoreDuplicates:true/);assert.match(source,/can_access_captacao/);assert.match(source,/auth.getUser/);
 assert.doesNotMatch(source,/from\("captacao_radar_oportunidades"\)\.update/);
});
test('handler deduplicates across pages and reruns, preserving human triage',async()=>{
 const existingUrl='https://pncp.gov.br/app/editais/12345678901234/2026/000001';
 const rows=new Map([[existingUrl,{id:'human',url_oficial:existingUrl,status_triagem:'inelegivel',motivo_triagem:'Revisado',captacao_edital_id:'kept'}]]);
 const original=JSON.stringify(rows.get(existingUrl));let handler;let finalLog;
 const client={from(table){let action,values,options;const q={
  insert(v){action='insert';values=v;return q},upsert(v,o){action='upsert';values=v;options=o;return q},
  select(){return q},single(){return q},update(v){action='update';values=v;return q},eq(){return q},abortSignal(){return q},
  then(resolve){
   if(table==='captacao_radar_sincronizacoes'){if(action==='update')finalLog=values;return Promise.resolve({data:{id:7},error:null}).then(resolve)}
   if(table==='captacao_radar_fontes')return Promise.resolve({data:{id:'source'},error:null}).then(resolve);
   assert.equal(options.ignoreDuplicates,true);const inserted=[];
   for(const row of values){if(!rows.has(row.url_oficial)){rows.set(row.url_oficial,row);inserted.push({id:row.url_oficial})}}
   return Promise.resolve({data:inserted,error:null}).then(resolve);
  }};return q;}};
 const sandbox=vm.createContext({URL,Date,Set,JSON,Number,Math,Error,TypeError,AbortSignal,AbortController,Response,setTimeout,clearTimeout,console:{log(){}},
  createClient:()=>client,Deno:{env:{get:key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'test-key':'test'},serve:fn=>handler=fn},
  fetch:async input=>{
   const url=new URL(input);if(url.hostname==='www.gov.br')return new Response('<html></html>');
   const page=Number(url.searchParams.get('pagina'));
   return body(page,3,[{numeroControlePNCP:`12345678901234-00000${page}-2026`,objetoCompra:'cultura',orgaoEntidade:{razaoSocial:'Órgão'}}]);
  }});
 vm.runInContext(stripTypeScriptTypes(source.replace(/^import .*\n/,'').replace('export async function','async function')),sandbox);
 for(let i=0;i<2;i++){
  const res=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test-key'}}));
  const result=await res.json();assert.equal(result.status,'sucesso',JSON.stringify(result));assert.equal(result.encontradas,3);assert.equal(result.novas,i===0?2:0);
  assert.equal(result.pncp.length,7);assert.ok(result.pncp.every(x=>x.paginas===3&&x.completa));assert.equal(finalLog.status,'sucesso');
 }
 assert.equal(JSON.stringify(rows.get(existingUrl)),original);assert.equal(rows.size,3);
 const denied=await handler(new Request('https://example.test',{method:'POST'}));assert.equal(denied.status,401);
});
