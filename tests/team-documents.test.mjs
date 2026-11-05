import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("supabase/functions/team-documents/index.ts","utf8");
const migration = await readFile("supabase/migrations/20261103153007_team_private_documents.sql","utf8");
const hardening = await readFile("supabase/migrations/20261103170908_team_private_documents_storage_hardening.sql","utf8");
const frontend = await readFile("src/app/pages/admin/TeamDocuments.tsx","utf8");
const code = ts.transpileModule(source.replace(/import \{ createClient \} from [^;]+;/,""),{
  compilerOptions: { target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.None }
}).outputText;
const sandbox = { Deno:{serve:()=>{}}, console, Uint8Array, Set, Object, RegExp, Error };
const helpers = vm.runInNewContext(code+"\n({mimeOf,fieldsOf,validPurpose,publicDocument,validateRequiredFields})",sandbox);

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
  assert.ok(frontend.includes('new Blob([data],{type:doc.mime_type || "application/octet-stream"})'));
});

test("política restritiva impede alterações diretas no bucket privado por usuários autenticados",()=>{
  assert.match(hardening,/as restrictive for update to authenticated/);
  assert.match(hardening,/as restrictive for delete to authenticated/);
  assert.ok(hardening.includes("bucket_id <> 'team-internal-docs'"));
});

test("campos essenciais por categoria e CPF com dígitos verificadores",()=>{
  assert.equal(helpers.validateRequiredFields("cpf",{numero:"529.982.247-25"}),undefined);
  assert.throws(()=>helpers.validateRequiredFields("cpf",{numero:"529.982.247-24"}),{message:/CPF/});
  assert.throws(()=>helpers.validateRequiredFields("cpf",{}),{message:/numero/});
  assert.throws(()=>helpers.validateRequiredFields("rg",{numero:"123456"}),{message:/orgao/});
  assert.throws(()=>helpers.validateRequiredFields("rg",{numero:"123456",orgao:"SSP",emissao:"03/05/2021"}),{message:/data de emissão/});
  assert.equal(helpers.validateRequiredFields("rg",{numero:"123456",orgao:"SSP",emissao:"2021-05-03"}),undefined);
});
test("cadastro sem anexo continua restrito e prévia exige arquivo",()=>{
  assert.match(source,/const file=input.file instanceof File \? input.file : null/);
  assert.match(source,/const path=fileKind \?/);
  assert.match(source,/if\(!doc.storage_path \|\| !doc.mime_type\) fail/);
  assert.match(source,/has_file:Boolean\(row.storage_path\)/);
  assert.match(frontend,/Adicionar PDF ou imagem/);
  assert.match(frontend,/Anexo salvo/);
  assert.match(frontend,/Dados sem anexo/);
});
test("perfil de todos os papéis incluindo admin master",async()=>{
  const { readFile }=await import("node:fs/promises");
  const sidebar=await readFile("src/app/components/admin/AdminSidebar.tsx","utf8");
  const routes=await readFile("src/app/routes.tsx","utf8");
  assert.match(sidebar,/label: "Meu Perfil"/);
  assert.match(sidebar,/allow: \["admin_alfa", "admin", "editor", "autor", "financeiro"\]/);
  assert.match(routes,/path: "perfil", loader: requireRoles\(\["admin_alfa", "admin", "editor", "autor", "financeiro"\]\)/);
});

test("painel de documentos possui contraste invertido e cards responsivos", async()=>{
  const ui=await readFile("src/app/pages/admin/TeamDocuments.tsx","utf8");
  assert.match(ui,/from-\[#064638\]/);
  assert.match(ui,/grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3/);
  assert.match(ui,/<article key=\{doc.id\}/);
  assert.match(ui,/Anexo salvo/);
  assert.match(ui,/Dados sem anexo/);
});
test("CPF recebe máscara automática e salvamento sem anexo", async()=>{
  const ui=await readFile("src/app/pages/admin/TeamDocuments.tsx","utf8");
  assert.match(ui,/function formatCpf\(value: string\)/);
  assert.match(ui,/formatCpf\(e.target.value\)/);
  assert.match(ui,/if\(file\) body.set\("file",file\)/);
  assert.match(ui,/O anexo é opcional/);
  assert.match(ui,/bg-emerald-600 px-4 py-2/);
});

test("prévia de dados somente após finalidade e auditoria, sem expor valores na listagem",()=>{
  assert.match(source,/if\(action==="detail"\)/);
  assert.match(source,/await audit\(id,"preview",purpose\)/);
  assert.match(source,/document:\{id:doc.id,title:doc.title,document_type:doc.document_type,fields:doc.fields/);
  assert.match(frontend,/action:"detail"/);
  assert.match(frontend,/Pré-visualização ilustrativa dos dados informados/);
  assert.match(frontend,/Não é documento emitido pelo governo/);
});
test("exclusão autorizada apaga dados e anexo e preserva trilha auditável",async()=>{
  const sql=await readFile("supabase/migrations/20261105000442_team_private_documents_audited_delete.sql","utf8");
  assert.match(sql,/status in \('active','archived','deleted'\)/);
  assert.match(sql,/action in \('upload','preview','field_read','archive','delete'\)/);
  assert.match(source,/if\(action==="delete"\)/);
  assert.match(source,/await audit\(id,"delete",purpose\)/);
  assert.match(source,/admin.storage.from\(BUCKET\).remove\(\[doc.storage_path\]\)/);
  assert.match(source,/title:"Documento excluído",fields:\{\},storage_path:null,mime_type:null,size_bytes:null/);
  assert.match(frontend,/action:"delete"/);
  assert.match(frontend,/Excluir definitivamente os dados/);
});
test("perfil possui seções recolhíveis independentes e currículo próprio",async()=>{
  const form=await readFile("src/app/pages/admin/AdminEquipeForm.tsx","utf8");
  for(const heading of ["Dados principais","Currículo","Matérias vinculadas","Portfólio","Publicação","Avatar","Documentos internos"]){
    assert.ok(form.includes(heading),heading);
  }
  assert.ok((form.match(/<details className="group rounded-xl border/g)||[]).length>=7);
  assert.match(form,/group-open:rotate-180/);
  assert.match(form,/TeamDocuments initialMemberId/);
});
