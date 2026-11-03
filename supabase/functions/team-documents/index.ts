/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "team-internal-docs";
const MAX_SIZE = 10 * 1024 * 1024;
const TYPES = new Set(["rg","cpf","cnh","comprovante","curriculo","certificado","contrato","declaracao","autenticado","outro"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD = /^[a-z][a-z0-9_]{1,39}$/;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-type",
};
const json = (data: unknown, status=200) => new Response(JSON.stringify(data), {
  status, headers: {...cors, "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"},
});
function fail(message:string, status=400):never { throw {message,status}; }
function validPurpose(raw:unknown) {
  const value=String(raw||"").trim();
  if(value.length<3 || value.length>400) fail("Informe a finalidade da consulta (3 a 400 caracteres).");
  return value;
}
function mimeOf(bytes:Uint8Array) {
  if(bytes.length>=5 && bytes[0]===0x25 && bytes[1]===0x50 && bytes[2]===0x44 && bytes[3]===0x46 && bytes[4]===0x2d)
    return {mime:"application/pdf",ext:"pdf"};
  if(bytes.length>=3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff)
    return {mime:"image/jpeg",ext:"jpg"};
  if(bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))
    return {mime:"image/png",ext:"png"};
  if(bytes.length>=12 && [82,73,70,70].every((v,i)=>bytes[i]===v) && [87,69,66,80].every((v,i)=>bytes[i+8]===v))
    return {mime:"image/webp",ext:"webp"};
  fail("Arquivo inválido. Envie um PDF, JPG, PNG ou WebP real.");
}
function fieldsOf(raw:unknown):Record<string,string> {
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) fail("Campos inválidos.");
  const pairs=Object.entries(raw as Record<string,unknown>);
  if(pairs.length>24) fail("Número excessivo de campos.");
  const fields:Record<string,string> = Object.create(null);
  for(const [key,value] of pairs) {
    if(!FIELD.test(key) || typeof value!=="string" || value.length>400) fail("Um dos campos do formulário é inválido.");
    if(value.trim()) fields[key]=value.trim();
  }
  return fields;
}
function publicDocument(row:any, ownerName:string) {
  return {
    id:row.id, member_id:row.member_id, member_name:ownerName,
    document_type:row.document_type,title:row.title,
    field_names:Object.keys(row.fields||{}),
    expires_on:row.expires_on,signed_copy:row.signed_copy,
    mime_type:row.mime_type,created_at:row.created_at,
  };
}
function fileName(title:string, mime:string) {
  const stem=title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,75)||"documento";
  return stem+"."+(mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":mime==="image/png"?"png":"webp");
}

Deno.serve(async (req:Request) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"Método não permitido."},405);
  try {
    const url=Deno.env.get("SUPABASE_URL");
    const anon=Deno.env.get("SUPABASE_ANON_KEY");
    const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!anon||!secret) fail("Configuração de documentos indisponível.",503);
    const authHeader=req.headers.get("Authorization")||"";
    if(!/^Bearer\s+\S+$/i.test(authHeader)) fail("Sessão ausente.",401);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:identity,error:authError}=await userClient.auth.getUser();
    if(authError||!identity.user) fail("Sessão inválida.",401);
    const userId=identity.user.id;
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    // Somente administradores formais acessam documentos de outros integrantes.
    // A função is_team_admin também inclui editores; não é adequada para dados pessoais.
    const [memberRes,assignedRolesRes]=await Promise.all([
      admin.from("equipe").select("id,nome").eq("user_id",userId).eq("ativo",true).maybeSingle(),
      admin.from("user_roles").select("role_id").eq("user_id",userId),
    ]);
    if(memberRes.error||assignedRolesRes.error) fail("Não foi possível verificar as permissões.",503);
    const ownMember=memberRes.data;
    const roleIds=(assignedRolesRes.data||[]).map((row:{role_id:string})=>row.role_id);
    let isAdmin=false;
    if(roleIds.length) {
      const {data:roles,error:rolesError}=await admin.from("roles").select("name").in("id",roleIds);
      if(rolesError) fail("Não foi possível verificar as permissões.",503);
      isAdmin=(roles||[]).some((role:{name:string})=>role.name==="admin_alfa"||role.name==="admin");
    }
    if(!ownMember&&!isAdmin) fail("Acesso reservado à equipe vinculada da RKC.",403);

    const form=req.headers.get("Content-Type")?.includes("multipart/form-data") ? await req.formData() : null;
    const input:any=form?{action:form.get("action"),member_id:form.get("member_id"),document_type:form.get("document_type"),
      title:form.get("title"),fields:form.get("fields"),expires_on:form.get("expires_on"),
      signed_copy:form.get("signed_copy"),file:form.get("file")}:await req.json();
    const action=String(input.action||"");
    const audit=async (documentId:string,kind:string,purpose:string,field_name:string|null=null) => {
      const {error}=await admin.from("team_private_document_access").insert({
        document_id:documentId,actor_user_id:userId,action:kind,purpose,field_name
      });
      if(error) fail("Não foi possível registrar o acesso. Tente novamente.",503);
    };
    if(action==="list") {
      let memberQuery=admin.from("equipe").select("id,nome").eq("ativo",true).order("nome");
      if(!isAdmin) memberQuery=memberQuery.eq("id",ownMember.id);
      const {data:members,error:memberError}=await memberQuery;
      if(memberError) fail("Falha ao listar integrantes.",503);
      let docsQuery=admin.from("team_private_documents")
        .select("id,member_id,document_type,title,fields,expires_on,signed_copy,mime_type,created_at")
        .eq("status","active").order("created_at",{ascending:false});
      if(!isAdmin) docsQuery=docsQuery.eq("member_id",ownMember.id);
      const {data:docs,error:docError}=await docsQuery.limit(500);
      if(docError) fail("Falha ao listar documentos.",503);
      const names=new Map((members||[]).map((m:any)=>[m.id,m.nome]));
      return json({ok:true,members:(members||[]),own_member_id:ownMember?.id||null,is_admin:isAdmin,
        documents:(docs||[]).map((d:any)=>publicDocument(d,names.get(d.member_id)||"Integrante arquivado"))});
    }
    if(action==="upload") {
      if(!form) fail("Envie o documento como formulário.");
      const memberId=String(input.member_id||"");
      const documentType=String(input.document_type||"");
      const title=String(input.title||"").trim();
      if(!UUID.test(memberId)||!TYPES.has(documentType)) fail("Integrante ou tipo de documento inválido.");
      if(!isAdmin && ownMember?.id!==memberId) fail("Você só pode cadastrar seus próprios documentos.",403);
      if(title.length<3||title.length>160) fail("Título deve ter entre 3 e 160 caracteres.");
      const member=await admin.from("equipe").select("id").eq("id",memberId).eq("ativo",true).maybeSingle();
      if(member.error||!member.data) fail("Integrante indisponível.",404);
      const file=input.file;
      if(!(file instanceof File)||file.size<1||file.size>MAX_SIZE) fail("Anexe um documento de até 10 MB.");
      const bytes=new Uint8Array(await file.arrayBuffer());
      const kind=mimeOf(bytes);
      const fields=fieldsOf(JSON.parse(String(input.fields||"{}")));
      const expires=String(input.expires_on||"").trim();
      if(expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) fail("Data de validade inválida.");
      const documentId=crypto.randomUUID();
      const path=`${memberId}/${documentId}.${kind.ext}`;
      const {error:uploadError}=await admin.storage.from(BUCKET).upload(path,new Blob([bytes],{type:kind.mime}),{
        contentType:kind.mime,cacheControl:"0",upsert:false,
      });
      if(uploadError) fail("Falha ao armazenar o arquivo privado.",503);
      let inserted=false;
      try {
        const {error}=await admin.from("team_private_documents").insert({
          id:documentId,member_id:memberId,document_type:documentType,title,fields,
          storage_path:path,mime_type:kind.mime,size_bytes:bytes.length,
          expires_on:expires||null,signed_copy:input.signed_copy==="true",created_by:userId,
        });
        if(error) fail("Falha ao registrar o documento.",503);
        inserted=true;
        await audit(documentId,"upload","Cadastro interno pelo integrante");
      } catch(err) {
        if(inserted) await admin.from("team_private_document_access").delete().eq("document_id",documentId);
        if(inserted) await admin.from("team_private_documents").delete().eq("id",documentId);
        await admin.storage.from(BUCKET).remove([path]);
        throw err;
      }
      return json({ok:true,id:documentId},201);
    }
    if(!["preview","field","history","archive"].includes(action)) fail("Operação desconhecida.");
    const id=String(input.id||"");
    if(!UUID.test(id)) fail("Documento inválido.");
    const {data:doc,error}=await admin.from("team_private_documents").select("*")
      .eq("id",id).eq("status","active").maybeSingle();
    if(error) fail("Falha ao consultar documento.",503);
    if(!doc) fail("Documento não encontrado.",404);
    // Verificar propriedade ANTES de fazer download, revelar campos ou histórico.
    if(!isAdmin && ownMember?.id!==doc.member_id) fail("Acesso ao documento não autorizado.",403);
    if(action==="preview") {
      const purpose=validPurpose(input.purpose);
      const {data:file,error:storageError}=await admin.storage.from(BUCKET).download(doc.storage_path);
      if(storageError||!file) fail("Arquivo indisponível.",503);
      await audit(id,"preview",purpose);
      return new Response(file,{status:200,headers:{
        // O cliente Supabase 2.94 interpreta imagens como texto se devolvermos image/*.
        // Enviar octet-stream faz invoke() preservar os bytes; o frontend restaura o MIME verificado.
        ...cors,"Content-Type":"application/octet-stream",
        "Content-Disposition":`inline; filename="${fileName(doc.title,doc.mime_type)}"`,
        "Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache",
        "X-Content-Type-Options":"nosniff",
        "Referrer-Policy":"no-referrer",
      }});
    }
    if(action==="field") {
      const purpose=validPurpose(input.purpose);
      const key=String(input.field_name||"");
      if(!FIELD.test(key)||!Object.prototype.hasOwnProperty.call(doc.fields||{},key)) fail("Campo não encontrado.",404);
      await audit(id,"field_read",purpose,key);
      return json({ok:true,field_name:key,value:doc.fields[key]});
    }
    if(action==="history") {
      if(!isAdmin && ownMember?.id!==doc.member_id) fail("Somente o titular ou a administração podem consultar o histórico.",403);
      const {data:events,error:historyError}=await admin.from("team_private_document_access")
        .select("actor_user_id,action,field_name,purpose,created_at").eq("document_id",id)
        .order("created_at",{ascending:false}).limit(100);
      if(historyError) fail("Falha ao consultar histórico.",503);
      return json({ok:true,events:events||[]});
    }
    if(!isAdmin && ownMember?.id!==doc.member_id) fail("Somente o titular ou a administração podem arquivar.",403);
    const purpose=validPurpose(input.purpose);
    await audit(id,"archive",purpose);
    const {error:archiveError}=await admin.from("team_private_documents").update({
      status:"archived",updated_at:new Date().toISOString()
    }).eq("id",id).eq("status","active");
    if(archiveError) fail("Falha ao arquivar documento.",503);
    return json({ok:true});
  } catch(err:any) {
    const status=Number(err?.status)||400;
    const message=typeof err?.message==="string"?err.message:"Falha na operação.";
    console.error("[team-documents]",status,message);
    return json({ok:false,error:message},status>=400 && status<=599?status:500);
  }
});
