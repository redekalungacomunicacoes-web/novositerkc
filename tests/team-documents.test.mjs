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

test("listagem restringe integrante aos próprios documentos e administradores têm papéis específicos",()=>{
  assert.match(source,/admin\.from\("user_roles"\)\.select\("role_id"\)/);
  assert.match(source,/role\.name==="admin_alfa"\|\|role\.name==="admin"/);
  assert.doesNotMatch(source,/userClient\.rpc\("is_team_admin"\)/);
  assert.match(source,/if\(!isAdmin\) memberQuery=memberQuery\.eq\("id",ownMember\.id\)/);
  assert.match(source,/if\(!isAdmin\) docsQuery=docsQuery\.eq\("member_id",ownMember\.id\)/);
  assert.match(source,/if\(!isAdmin && ownMember\?\.id!==doc\.member_id\) fail\("Acesso ao documento não autorizado\.",403\)/);
  assert.match(frontend,/\{isAdmin && <label[^\n]+Ver toda a equipe/);
});

test("servidor bloqueia vazamento entre integrantes e mantém auditoria no acesso permitido", async()=>{
  const ownerA="10000000-0000-4000-8000-000000000001";
  const ownerB="10000000-0000-4000-8000-000000000002";
  const docA="20000000-0000-4000-8000-000000000001";
  const docB="20000000-0000-4000-8000-000000000002";
  const users={a:"user-a",b:"user-b",admin:"user-admin"};
  let acting=users.a, role="editor", handler;
  const audit=[], members=[
    {id:ownerA,nome:"A",user_id:users.a,ativo:true},
    {id:ownerB,nome:"B",user_id:users.b,ativo:true},
  ];
  const docs=[
    {id:docA,member_id:ownerA,document_type:"rg",title:"RG A",status:"active",fields:{numero:"111"},storage_path:"a/a.pdf",mime_type:"application/pdf"},
    {id:docB,member_id:ownerB,document_type:"cpf",title:"CPF B",status:"active",fields:{numero:"222"},storage_path:"b/b.pdf",mime_type:"application/pdf"},
  ];
  let downloads=0;
  function query(table) {
    let rows={
      equipe:members,
      user_roles:[{user_id:users.a,role_id:"r"},{user_id:users.b,role_id:"r"},{user_id:users.admin,role_id:"r"}],
      roles:[{id:"r",name:role}],
      team_private_documents:docs,
    }[table]||[];
    const q={
      select:()=>q,
      eq:(key,val)=>{rows=rows.filter(x=>x[key]===val);return q;},
      in:(key,vals)=>{rows=rows.filter(x=>vals.includes(x[key]));return q;},
      order:()=>q,
      limit:(max)=>{rows=rows.slice(0,max);return q;},
      maybeSingle:async()=>({data:rows[0]||null,error:null}),
      insert:async(payload)=>{audit.push(payload);return {error:null};},
      then:(yes,no)=>Promise.resolve({data:rows,error:null}).then(yes,no),
    };
    return q;
  }
  const vmSandbox={
    Deno:{
      env:{get:key=>key==="SUPABASE_URL"?"https://fixture.supabase.co":key==="SUPABASE_ANON_KEY"?"anon":"secret"},
      serve:fn=>{handler=fn;},
    },
    console, Uint8Array, Set, Object, RegExp, Error, Response, Request, Blob, File, crypto,
    createClient:(_url,key)=>key==="secret"
      ? {from:query,storage:{from:()=>({download:async()=>{downloads++;return {data:new Blob(["pdf"]),error:null};}})}}
      : {auth:{getUser:async()=>({data:{user:acting?{id:acting}:null},error:null})}},
  };
  vm.runInNewContext(code,vmSandbox);
  const call=(action,id,purpose)=>handler(new Request("https://fixture/documents",{method:"POST",
    headers:{Authorization:"Bearer fixture","Content-Type":"application/json"},
    body:JSON.stringify({action,id,purpose})}));
  let response=await call("list");
  assert.equal(response.status,200);
  let body=await response.json();
  assert.equal(body.is_admin,false);
  assert.deepEqual(body.documents.map(x=>x.id),[docA]);
  assert.deepEqual(body.members.map(x=>x.id),[ownerA]);
  response=await call("preview",docB,"inscrição de projeto");
  assert.equal(response.status,403);
  assert.equal(downloads,0);
  response=await call("field",docB,"inscrição de projeto");
  assert.equal(response.status,403);
  response=await call("preview",docA,"inscrição de projeto");
  assert.equal(response.status,200);
  assert.equal(downloads,1);
  assert.equal(audit.length,1);
  assert.equal(audit[0].action,"preview");
  acting=users.admin; role="admin";
  body=await (await call("list")).json();
  assert.equal(body.is_admin,true);
  assert.equal(body.documents.length,2);
  response=await call("preview",docB,"edital autorizado");
  assert.equal(response.status,200);
  assert.equal(audit.length,2);
  acting=users.a;role="editor";
  assert.equal((await (await call("list")).json()).is_admin,false);
  acting=null;
  response=await call("preview",docA,"edital autorizado");
  assert.equal(response.status,401);
});

test("prévia binária preserva os bytes de PDFs e imagens com MIME correto",()=>{
  assert.ok(source.includes('"Content-Type":"application/octet-stream"'));
  assert.ok(frontend.includes("new Blob([data],{type:doc.mime_type})"));
});
