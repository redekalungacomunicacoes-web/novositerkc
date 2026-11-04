import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Eye, Plus, ShieldCheck, Search, Archive, History, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DocType = "rg" | "cpf" | "cnh" | "comprovante" | "curriculo" | "certificado" | "contrato" | "declaracao" | "autenticado" | "outro";
type Member = { id: string; nome: string };
type InternalDoc = {
  id: string; member_id: string; member_name: string; document_type: DocType; title: string;
  field_names: string[]; expires_on: string | null; signed_copy: boolean;
  mime_type: string | null; has_file: boolean; created_at: string;
};
type Event = { actor_user_id: string; action: string; field_name: string | null; purpose: string; created_at: string };
type ApiList = { ok: boolean; error?: string; members: Member[]; documents: InternalDoc[]; own_member_id: string | null; is_admin: boolean };
type DocumentField = [key: string, label: string, required: boolean];
const categories: Record<DocType, { label: string; fields: DocumentField[] }> = {
  rg: { label: "RG / Identidade", fields: [["numero","Número do RG",true],["orgao","Órgão emissor",true],["emissao","Data de emissão",true],["uf","UF",false]] },
  cpf: { label: "CPF", fields: [["numero","Número do CPF",true]] },
  cnh: { label: "CNH", fields: [["numero","Número da CNH",true],["categoria","Categoria",true],["validade","Validade",true]] },
  comprovante: { label: "Comprovante de residência", fields: [["endereco","Endereço",true],["referencia","Mês de referência",true]] },
  curriculo: { label: "Currículo", fields: [["versao","Versão / referência",true]] },
  certificado: { label: "Certificado", fields: [["instituicao","Instituição",true],["curso","Curso / atividade",true],["carga_horaria","Carga horária",false]] },
  contrato: { label: "Contrato", fields: [["referencia","Número / referência",true],["partes","Partes",true]] },
  declaracao: { label: "Declaração", fields: [["finalidade","Finalidade",true],["emissao","Data de emissão",false]] },
  autenticado: { label: "Documento autenticado / assinado", fields: [["referencia","Referência",true],["autenticacao","Informações de autenticação",true]] },
  outro: { label: "Outro documento", fields: [["descricao","Descrição",true],["referencia","Referência",false]] },
};
function documentValidation(kind: DocType, fields: Record<string,string>): string {
  for(const [key,label,required] of categories[kind].fields) {
    if(required && !fields[key]?.trim()) return `Preencha o campo obrigatório: ${label}.`;
  }
  if(kind==="cpf") {
    const digits=(fields.numero || "").replace(/\\D/g,"");
    if(digits.length !== 11 || /^(\\d)\\1{10}$/.test(digits)) return "Informe um CPF válido com 11 dígitos.";
    const check=(length:number)=> ((digits.slice(0,length).split("").reduce((sum,d,i)=>sum+Number(d)*(length+1-i),0)*10)%11)%10;
    if(check(9)!==Number(digits[9])||check(10)!==Number(digits[10])) return "Número de CPF inválido.";
  }
  if(kind==="rg" && (fields.numero || "").replace(/[^a-z0-9]/gi,"").length<4) return "Informe um número de RG válido.";
  return "";
}
async function getError(error: unknown, data: unknown) {
  const payload = data as { error?: string } | null;
  if (payload?.error) return payload.error;
  const response = (error as { context?: Response } | null)?.context;
  if (response instanceof Response) {
    try { const json = await response.clone().json(); if (json?.error) return String(json.error); } catch { /* ignore non-JSON response */ }
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}
function prettyAction(action: string) {
  return ({upload:"Cadastro",preview:"Pré-visualização",field_read:"Consulta de dado",archive:"Arquivamento"} as Record<string,string>)[action] || action;
}

export function TeamDocuments({ initialMemberId }: { initialMemberId: string }) {
  const [documents, setDocuments] = useState<InternalDoc[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownMemberId, setOwnMemberId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [ownerId, setOwnerId] = useState(initialMemberId);
  const [kind, setKind] = useState<DocType>("rg");
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string,string>>({});
  const [expiresOn, setExpiresOn] = useState("");
  const [signedCopy, setSignedCopy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [purpose, setPurpose] = useState("");
  const [preview, setPreview] = useState<{ document: InternalDoc; url: string } | null>(null);
  const [fieldResult, setFieldResult] = useState<{ id: string; key: string; value: string } | null>(null);
  const [history, setHistory] = useState<{ docId: string; events: Event[] } | null>(null);
  const [fieldSelection, setFieldSelection] = useState<Record<string,string>>({});

  useEffect(() => {
    return () => { if (preview?.url) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  async function refresh() {
    setLoading(true); setError("");
    const { data, error: requestError } = await supabase.functions.invoke<ApiList>("team-documents", { body: { action: "list" } });
    setLoading(false);
    if (requestError || !data?.ok) { setError(await getError(requestError, data)); return; }
    setDocuments(data.documents || []);
    setMembers(data.members || []);
    setOwnMemberId(data.own_member_id || null);
    setIsAdmin(Boolean(data.is_admin));
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setOwnerId(initialMemberId); setShowAll(false); }, [initialMemberId]);

  const filtered = useMemo(() => documents.filter(d =>
    (showAll || d.member_id === initialMemberId) &&
    (d.title+" "+d.member_name+" "+categories[d.document_type]?.label).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
  ), [documents,initialMemberId,showAll,query]);
  const canCreate = isAdmin || ownMemberId === ownerId;
  const missingRequired = documentValidation(kind,fields);

  async function upload() {
    if (!canCreate || title.trim().length < 3) { setError("Informe um título válido e verifique as permissões."); return; }
    if (missingRequired) { setError(missingRequired); return; }
    if (file && file.size > 10*1024*1024) { setError("O arquivo deve ter no máximo 10 MB."); return; }
    setBusy(true); setError("");
    const body = new FormData();
    body.set("action","upload"); body.set("member_id",ownerId);
    body.set("document_type",kind); body.set("title",title.trim());
    body.set("fields",JSON.stringify(fields));
    body.set("expires_on",expiresOn);
    body.set("signed_copy",signedCopy?"true":"false");
    if(file) body.set("file",file);
    const result = await supabase.functions.invoke<{ok:boolean;error?:string}>("team-documents",{body});
    setBusy(false);
    if(result.error || !result.data?.ok) { setError(await getError(result.error,result.data)); return; }
    setTitle(""); setFields({}); setExpiresOn(""); setSignedCopy(false); setFile(null);
    if(fileInputRef.current) fileInputRef.current.value="";
    await refresh();
  }

  async function openDocument(doc:InternalDoc) {
    if (!doc.has_file) { setError("Este documento não tem arquivo anexado."); return; }
    if (purpose.trim().length<3) { setError("Informe primeiro a finalidade da consulta."); return; }
    setBusy(true);setError("");setFieldResult(null);
    const {data,error:callError}=await supabase.functions.invoke<Blob>("team-documents",{
      body:{action:"preview",id:doc.id,purpose:purpose.trim()},
    });
    setBusy(false);
    if(callError || !(data instanceof Blob)) {setError(await getError(callError,data));return;}
    const typedBlob=new Blob([data],{type:doc.mime_type || "application/octet-stream"});
    const url=URL.createObjectURL(typedBlob);
    setPreview({document:doc,url});
  }

  async function readField(doc:InternalDoc) {
    const key=fieldSelection[doc.id] || doc.field_names[0];
    if (!key) return;
    if (purpose.trim().length<3) { setError("Informe primeiro a finalidade da consulta."); return; }
    setBusy(true);setError("");setFieldResult(null);
    const {data,error:callError}=await supabase.functions.invoke<{ok:boolean;error?:string;value:string}>("team-documents",{
      body:{action:"field",id:doc.id,field_name:key,purpose:purpose.trim()}
    });
    setBusy(false);
    if(callError||!data?.ok) {setError(await getError(callError,data));return;}
    setFieldResult({id:doc.id,key,value:data.value});
  }

  async function loadHistory(doc:InternalDoc) {
    setBusy(true);setError("");
    const {data,error:callError}=await supabase.functions.invoke<{ok:boolean;error?:string;events:Event[]}>("team-documents",{
      body:{action:"history",id:doc.id}
    });
    setBusy(false);
    if(callError||!data?.ok) {setError(await getError(callError,data));return;}
    setHistory({docId:doc.id,events:data.events||[]});
  }

  async function archiveDocument(doc:InternalDoc) {
    const reason=window.prompt("Motivo do arquivamento (mínimo 3 caracteres):");
    if(reason===null) return;
    if(reason.trim().length<3) {setError("Informe um motivo válido.");return;}
    if(!window.confirm("Arquivar este documento? Ele não poderá mais ser consultado pela equipe.")) return;
    setBusy(true);setError("");
    const {data,error:callError}=await supabase.functions.invoke<{ok:boolean;error?:string}>("team-documents",{
      body:{action:"archive",id:doc.id,purpose:reason.trim()}
    });
    setBusy(false);
    if(callError||!data?.ok) {setError(await getError(callError,data));return;}
    await refresh();
  }

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm space-y-5" aria-label="Documentos internos da equipe">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
        <div>
          <h2 className="text-lg font-semibold">Documentos internos da equipe</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Área privada. Cada integrante consulta apenas os próprios documentos; administradores autorizados podem consultar documentos da equipe.
            Toda prévia e consulta de dado fica registrada. Não use a área pública de portfólio para documentos pessoais.
          </p>
        </div>
      </div>
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <details className="border rounded-lg p-4" open={undefined}>
        <summary className="font-medium cursor-pointer flex items-center gap-2"><Plus className="w-4 h-4"/> Adicionar documento</summary>
        <div className="space-y-3 mt-4">
          {isAdmin && (
            <label className="block text-sm">Titular
              <select value={ownerId} onChange={e=>setOwnerId(e.target.value)} className="block w-full mt-1 rounded border bg-background p-2">
                {members.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
          )}
          {!isAdmin && ownMemberId !== ownerId && <p className="text-sm text-muted-foreground">Somente o titular pode cadastrar seus próprios documentos.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Tipo de documento
              <select value={kind} onChange={e=>{setKind(e.target.value as DocType);setFields({});}} className="block w-full mt-1 rounded border bg-background p-2">
                {(Object.keys(categories) as DocType[]).map(k=><option key={k} value={k}>{categories[k].label}</option>)}
              </select>
            </label>
            <label className="text-sm">Título
              <input value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} className="block w-full mt-1 rounded border bg-background p-2" placeholder="Ex.: RG atualizado" />
            </label>
            {categories[kind].fields.map(([key,label,required])=>(
              <label className="text-sm" key={key}>{label} <span className="text-muted-foreground">{required?"(obrigatório)":"(opcional)"}</span>
                <input type={["emissao","validade"].includes(key)?"date":"text"} required={required}
                  value={fields[key]||""} maxLength={400} onChange={e=>setFields(prev=>({...prev,[key]:e.target.value}))}
                  className="block w-full mt-1 rounded border bg-background p-2" autoComplete="off" />
              </label>
            ))}
            <label className="text-sm">Validade (quando houver)
              <input type="date" value={expiresOn} onChange={e=>setExpiresOn(e.target.value)}
                className="block w-full mt-1 rounded border bg-background p-2" />
            </label>
            <div className="space-y-2 text-sm">
              <p>Arquivo PDF ou imagem <span className="text-muted-foreground">(opcional, até 10 MB)</span></p>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={e=>setFile(e.target.files?.[0]||null)} className="sr-only" aria-label="Selecionar arquivo do documento" />
              <button type="button" onClick={()=>fileInputRef.current?.click()}
                className="rounded border bg-background px-3 py-2 text-sm font-medium">Adicionar PDF ou imagem</button>
              {file ? <div className="rounded border bg-muted/40 p-2 flex items-center justify-between gap-2" role="status">
                <span className="min-w-0 truncate"><FileText className="h-4 w-4 inline mr-1" />{file.name} ({(file.size/1024).toFixed(0)} KB) — selecionado, aguardando salvar</span>
                <button type="button" className="shrink-0 underline" onClick={()=>{setFile(null);if(fileInputRef.current)fileInputRef.current.value="";}}>Remover</button>
              </div> : <p className="text-xs text-muted-foreground">Nenhum arquivo selecionado. É possível salvar apenas os dados do documento.</p>}
            </div>
          </div>
          {file && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={signedCopy} onChange={e=>setSignedCopy(e.target.checked)} />
            Este arquivo contém uma assinatura / autenticação pré-existente (não verificada pela RKC)
          </label>}
          {missingRequired && <p className="text-xs text-amber-700" role="status">{missingRequired}</p>}
          <button type="button" disabled={busy||!canCreate||Boolean(missingRequired)||title.trim().length<3}
            onClick={()=>void upload()} className="rounded bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-50">
            {busy?"Salvando...":"Salvar documento privado"}
          </button>
        </div>
      </details>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-medium flex-1">Documentos cadastrados</h3>
          {isAdmin && <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)} /> Ver toda a equipe</label>}
        </div>
        <label className="block text-sm">Finalidade da consulta (obrigatória para abrir arquivo ou revelar um dado)
          <input value={purpose} maxLength={400} onChange={e=>setPurpose(e.target.value)}
            placeholder="Ex.: preencher requisitos do edital RKC-2026-05"
            className="block w-full mt-1 rounded border p-2 bg-background" />
        </label>
        <label className="relative block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar documentos ou integrante"
            className="rounded border w-full bg-background pl-9 pr-3 py-2 text-sm" />
        </label>
        {loading && <p className="text-sm text-muted-foreground">Carregando documentos...</p>}
        {!loading && filtered.length===0 && <p className="text-sm text-muted-foreground rounded border p-3">Nenhum documento encontrado.</p>}
        <div className="space-y-2">
          {filtered.map(doc=>(
            <div key={doc.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex gap-3 items-start">
                <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm break-words">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">{doc.member_name} · {categories[doc.document_type]?.label||doc.document_type}
                    {doc.expires_on?` · validade: ${new Date(doc.expires_on+"T12:00:00").toLocaleDateString("pt-BR")}`:""}
                    {doc.signed_copy?" · arquivo informado como assinado":""}
                    {doc.has_file?" · anexo salvo":" · sem anexo"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {doc.has_file && <button type="button" disabled={busy||purpose.trim().length<3} onClick={()=>void openDocument(doc)}
                  className="inline-flex items-center gap-1 border rounded px-3 py-1.5 text-xs disabled:opacity-50"><Eye className="w-3.5 h-3.5" /> Pré-visualizar anexo</button>}
                {doc.field_names.length>0 && <>
                  <select aria-label="Campo do documento" value={fieldSelection[doc.id]||doc.field_names[0]}
                    onChange={e=>setFieldSelection(prev=>({...prev,[doc.id]:e.target.value}))}
                    className="border bg-background rounded px-2 py-1.5 text-xs">
                    {doc.field_names.map(key=><option key={key} value={key}>{key.replaceAll("_"," ")}</option>)}
                  </select>
                  <button type="button" disabled={busy||purpose.trim().length<3} onClick={()=>void readField(doc)}
                    className="border rounded px-3 py-1.5 text-xs disabled:opacity-50">Consultar dado</button>
                </>}
                {(isAdmin||ownMemberId===doc.member_id) && <>
                  <button type="button" disabled={busy} onClick={()=>void loadHistory(doc)}
                    className="inline-flex gap-1 items-center border rounded px-3 py-1.5 text-xs"><History className="w-3 h-3"/> Histórico</button>
                  <button type="button" disabled={busy} onClick={()=>void archiveDocument(doc)}
                    className="inline-flex gap-1 items-center border rounded px-3 py-1.5 text-xs text-red-600"><Archive className="w-3 h-3"/> Arquivar</button>
                </>}
              </div>
              {fieldResult?.id===doc.id && (
                <div className="bg-muted rounded p-3 text-sm" role="status">
                  <strong>{fieldResult.key.replaceAll("_"," ")}:</strong> {fieldResult.value}
                  <p className="text-xs text-muted-foreground mt-1">Consulta registrada no histórico.</p>
                </div>
              )}
              {history?.docId===doc.id && (
                <div className="rounded bg-muted p-3 space-y-2 text-xs">
                  <div className="flex justify-between"><strong>Histórico de acessos</strong><button type="button" onClick={()=>setHistory(null)} aria-label="Fechar histórico"><X className="w-4 h-4"/></button></div>
                  {history.events.length===0&&<p>Sem eventos.</p>}
                  {history.events.map((ev,i)=><p key={i} className="border-t pt-2">
                    {new Date(ev.created_at).toLocaleString("pt-BR")} · {prettyAction(ev.action)}
                    {ev.field_name?` · ${ev.field_name}`:""} · {ev.purpose}
                    <span className="block text-muted-foreground">Usuário: {ev.actor_user_id}</span>
                  </p>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Pré-visualização de documento interno">
          <div className="bg-card rounded-lg w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between gap-2">
              <span className="font-medium text-sm truncate">{preview.document.title} — consulta registrada</span>
              <button type="button" onClick={()=>setPreview(null)} className="border rounded p-2" aria-label="Fechar pré-visualização"><X className="h-4 w-4"/></button>
            </div>
            {preview.document.mime_type==="application/pdf" ? (
              <iframe title="Documento privado" src={preview.url+"#toolbar=0&navpanes=0"} className="w-full h-[78vh] bg-white" />
            ) : (
              <div className="overflow-auto flex items-center justify-center p-4"><img src={preview.url} alt={preview.document.title} className="max-h-[78vh] object-contain" /></div>
            )}
            <p className="px-3 py-2 text-xs text-muted-foreground">Visualização interna. O navegador pode permitir salvar ou capturar a tela; evite compartilhar dados pessoais.</p>
          </div>
        </div>
      )}
    </section>
  );
}
