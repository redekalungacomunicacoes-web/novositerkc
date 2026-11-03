import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("supabase/functions/team-documents/index.ts","utf8");
const migration = await readFile("supabase/migrations/20261103130000_team_private_documents.sql","utf8");
const frontend = await readFile("src/app/pages/admin/TeamDocuments.tsx","utf8");
const code = ts.transpileModule(source.replace(/import \{ createClient \} from [^;]+;/,""),{
  compilerOptions: { target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.None }
}).outputText;
const sandbox = { Deno:{serve:()=>{}}, console, Uint8Array, Set, Object, RegExp, Error };
const helpers = vm.runInNewContext(code+"\n({mimeOf,fieldsOf,validPurpose,publicDocument})",sandbox);

test("somente PDFs ou imagens reconhecidas pelo conteúdo são aceitos",()=>{
  assert.equal(helpers.mimeOf(new Uint8Array([37,80,68,70,45,49])).mime,"application/pdf");
  assert.equal(helpers.mimeOf(new Uint8Array([255,216,255,1])).mime,"image/jpeg");
  assert.equal(helpers.mimeOf(new Uint8Array([137,80,78,71,13,10,26,10])).mime,"image/png");
  assert.equal(helpers.mimeOf(new Uint8Array([82,73,70,70,1,2,3,4,87,69,66,80])).mime,"image/webp");
  assert.throws(()=>helpers.mimeOf(new Uint8Array([60,104,116,109,108,62])), {message:/Arquivo inválido/});
});
test("campos cadastrados respeitam tamanho e nomes controlados",()=>{
  assert.equal(helpers.fieldsOf({numero:"  123-45 ",orgao:"SSP"}).numero,"123-45");
  assert.throws(()=>helpers.fieldsOf(Object.fromEntries([["__proto__", "evil"]])), {message:/inválido/});
  assert.throws(()=>helpers.fieldsOf({numero:"a".repeat(401)}), {message:/inválido/});
  assert.throws(()=>helpers.fieldsOf(Array.from({length:25},(_,i)=>["campo"+i,"x"]).reduce((o,[k,v])=>({...o,[k]:v}),{})), {message:/excessivo/});
});
test("finalidade obrigatória para pré-visualizar ou acessar dados",()=>{
  assert.throws(()=>helpers.validPurpose("a"),{message:/finalidade/});
  assert.equal(helpers.validPurpose("  edital 123  "),"edital 123");
  assert.match(source,/await audit\(id,"preview",purpose\)/);
  assert.match(source,/await audit\(id,"field_read",purpose,key\)/);
});
test("listagem não entrega números de documentos ou caminhos internos",()=>{
  const row={id:"doc",member_id:"m",document_type:"rg",title:"RG",fields:{numero:"123456"},storage_path:"secret/path",mime_type:"application/pdf"};
  const item=helpers.publicDocument(row,"Pessoa");
  assert.equal(item.member_name,"Pessoa");
  assert.deepEqual(Array.from(item.field_names),["numero"]);
  assert.equal(JSON.stringify(item).includes("123456"),false);
  assert.equal(JSON.stringify(item).includes("secret/path"),false);
});
test("servidor exige vínculo autenticado e valida permissão por titular",()=>{
  assert.match(source,/userClient\.auth\.getUser\(\)/);
  assert.match(source,/if\(!ownMember&&!isAdmin\)/);
  assert.match(source,/!isAdmin && ownMember\?\.id!==memberId/);
  assert.match(source,/if\(!isAdmin && ownMember\?\.id!==doc\.member_id\)/);
});
test("bucket e metadados sem leitura pública ou autenticada direta",()=>{
  assert.match(migration,/values \('team-internal-docs','team-internal-docs',false/);
  assert.match(migration,/revoke all on public\.team_private_documents from public, anon, authenticated/);
  assert.match(migration,/revoke all on public\.team_private_document_access from public, anon, authenticated/);
  assert.doesNotMatch(migration,/create policy [^;]*team-internal-docs/);
  assert.match(frontend,/action:"preview"/);
  assert.match(frontend,/action:"field"/);
  assert.match(frontend,/action:"history"/);
});
