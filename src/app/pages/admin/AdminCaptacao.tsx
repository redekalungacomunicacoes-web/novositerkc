import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Check, CirclePlus, FileUp, Loader2, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Edital = { id: string; protocol: string; title: string; funder: string; category: string; deadline: string | null; status: string; eligibility_status: string; eligibility_opinion: string | null; manager_approved_at: string | null; created_at: string };
type Requirement = { id: string; edital_id: string; description: string; status: "pending" | "met" | "not_met"; evidence: string | null };
type Task = { id: string; edital_id: string; title: string; assignee_id: string | null; assignee_name?: string; due_date: string | null; priority: string; status: string };
type Member = { id: string; nome: string; user_id?: string | null };
type Attachment = { id: string; edital_id: string; file_name: string; storage_path: string; category: string; created_at: string };
type Audit = { id: string; actor_name: string; action: string; entity: string; edital_id: string; created_at: string; detail: string };
const STATUS: Record<string, string> = { pending_confirmation: "A confirmar", pending_eligibility: "Análise de elegibilidade", em_elaboracao: "Em elaboração", inscrito: "Inscrito", encerrado: "Encerrado" };
const PRIORITY: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const dateLabel = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Prazo a confirmar";

export function AdminCaptacao() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskDueFilter, setTaskDueFilter] = useState("all");
  const [canApprove, setCanApprove] = useState(false);
  const [myMemberId, setMyMemberId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFunder, setNewFunder] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [requirementText, setRequirementText] = useState("");
  const [opinion, setOpinion] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("media");
  const [file, setFile] = useState<File | null>(null);
  const [fileCategory, setFileCategory] = useState("documento");

  async function load() {
    setLoading(true); setError("");
    try {
      const [{ data: ed, error: ee }, { data: req, error: re }, { data: ts, error: te }, { data: team, error: me }, { data: files, error: fe }, { data: log, error: le }, user] = await Promise.all([
        supabase.from("captacao_editais").select("*").order("deadline", { ascending: true, nullsFirst: false }),
        supabase.from("captacao_requisitos").select("*").order("created_at"),
        supabase.from("captacao_tarefas").select("id,edital_id,title,assignee_id,due_date,priority,status,assignee:equipe!captacao_tarefas_assignee_id_fkey(nome)").order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("equipe").select("id,nome,user_id,ativo").eq("ativo", true).order("nome"),
        supabase.from("captacao_anexos").select("*").order("created_at", { ascending: false }),
        supabase.from("captacao_auditoria").select("id,actor_name,action,entity,edital_id,created_at,detail").order("created_at", { ascending: false }).limit(20),
        supabase.auth.getUser(),
      ]);
      const firstError = ee || re || te || me || fe || le;
      if (firstError) throw firstError;
      const current = user.data.user?.id;
      const member = (team || []).find((m: any) => m.user_id === current);
      setEditais((ed || []) as Edital[]); setRequirements((req || []) as Requirement[]);
      setTasks((ts || []).map((t: any) => ({ ...t, assignee_name: Array.isArray(t.assignee) ? t.assignee[0]?.nome : t.assignee?.nome })) as Task[]);
      setMembers((team || []) as Member[]); setAttachments((files || []) as Attachment[]); setAudit((log || []) as Audit[]);
      setMyMemberId(member?.id || ""); setCanApprove(Boolean(member && member.nome.trim().toLocaleLowerCase("pt-BR") === "felipe"));
      setSelectedId((old) => (ed || []).some((x: Edital) => x.id === old) ? old : (ed?.[0]?.id || ""));
    } catch (e) { setError((e as Error).message || "Não foi possível carregar o módulo."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const selected = editais.find((e) => e.id === selectedId) || null;
  const filtered = useMemo(() => editais.filter((e) => (statusFilter === "all" || e.status === statusFilter) && `${e.protocol} ${e.title} ${e.funder}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [editais, statusFilter, query]);
  const today = new Date().toISOString().slice(0, 10);
  const myTasks = taskFilter === "all" ? tasks : tasks.filter((t) => t.assignee_id === (taskFilter === "mine" ? myMemberId : taskFilter));
  const visibleTasks = myTasks.filter((t) => t.edital_id === selectedId)
    .filter((t) => taskStatusFilter === "all" || t.status === taskStatusFilter)
    .filter((t) => taskDueFilter === "all" || (taskDueFilter === "late" ? Boolean(t.due_date && t.due_date < today && t.status !== "concluida") : taskDueFilter === "next" ? Boolean(t.due_date && t.due_date >= today && t.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)) : !t.due_date));
  const selectedRequirements = requirements.filter((r) => r.edital_id === selectedId);
  const selectedAttachments = attachments.filter((a) => a.edital_id === selectedId);
  const lateTasks = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "concluida").length;
  const dueSoon = editais.filter((e) => e.deadline && e.deadline >= today && (new Date(`${e.deadline}T12:00:00`).getTime() - Date.now()) < 8 * 86400000 && !["encerrado", "inscrito"].includes(e.status)).length;
  const openTasks = tasks.filter((t) => t.status !== "concluida").length;

  async function addEdital(event: React.FormEvent) {
    event.preventDefault(); if (!newTitle.trim() || !newFunder.trim()) return;
    setSaving(true);
    try {
      const payload = { title: newTitle.trim(), funder: newFunder.trim(), category: newCategory.trim() || "Não informado", deadline: newDeadline || null };
      const result = editing && selected ? await supabase.from("captacao_editais").update(payload).eq("id", selected.id) : await supabase.from("captacao_editais").insert({ ...payload, status: "pending_confirmation", eligibility_status: "pending_verification" });
      if (result.error) throw result.error; toast.success(editing ? "Edital atualizado." : "Oportunidade cadastrada para confirmação."); setFormOpen(false); setEditing(false); setNewTitle(""); setNewFunder(""); setNewCategory(""); setNewDeadline(""); await load();
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function addRequirement(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !requirementText.trim()) return; setSaving(true);
    try { const { error: e } = await supabase.from("captacao_requisitos").insert({ edital_id: selected.id, description: requirementText.trim(), status: "pending" }); if (e) throw e; setRequirementText(""); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function updateRequirement(r: Requirement, status: Requirement["status"]) {
    const { error: e } = await supabase.from("captacao_requisitos").update({ status }).eq("id", r.id); if (e) toast.error(e.message); else await load();
  }
  async function saveEligibility(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return; setSaving(true);
    const next = selectedRequirements.length > 0 && selectedRequirements.every((r) => r.status === "met") ? "approved" : selectedRequirements.some((r) => r.status === "not_met") ? "not_eligible" : "pending_verification";
    try { const { error: e } = await supabase.from("captacao_editais").update({ eligibility_status: next, eligibility_opinion: opinion.trim() }).eq("id", selected.id); if (e) throw e; toast.success("Parecer de elegibilidade registrado."); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function approveAdvance() {
    if (!selected) return; setSaving(true);
    try { const { error: e } = await supabase.from("captacao_editais").update({ manager_approved_at: new Date().toISOString(), status: "em_elaboracao" }).eq("id", selected.id); if (e) throw e; toast.success("Avanço aprovado; edital liberado para elaboração."); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function addTask(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !taskTitle.trim() || !taskAssignee) return; setSaving(true);
    try { const { error: e } = await supabase.from("captacao_tarefas").insert({ edital_id: selected.id, title: taskTitle.trim(), assignee_id: taskAssignee, due_date: taskDue || null, priority: taskPriority, status: "pendente", created_by: myMemberId }); if (e) throw e; setTaskTitle(""); setTaskDue(""); setTaskOpen(false); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function updateTask(task: Task, patch: Partial<Task>) { const { error: e } = await supabase.from("captacao_tarefas").update(patch).eq("id", task.id); if (e) toast.error(e.message); else await load(); }
  async function uploadAttachment(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !file) return; setSaving(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const storagePath = `${selected.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("captacao-editais").upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream" }); if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("captacao_anexos").insert({ edital_id: selected.id, file_name: file.name, storage_path: storagePath, category: fileCategory, uploaded_by: myMemberId });
      if (insertError) { await supabase.storage.from("captacao-editais").remove([storagePath]); throw insertError; }
      setFile(null); await load(); toast.success("Arquivo privado anexado ao edital.");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function openAttachment(item: Attachment) { const { data, error: e } = await supabase.storage.from("captacao-editais").createSignedUrl(item.storage_path, 300); if (e) toast.error(e.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">REDE KALUNGA · ADMINISTRAÇÃO</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Editais e captação</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Oportunidades, elegibilidade, tarefas e documentos em um só lugar.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted" aria-label="Atualizar"><RefreshCw size={16}/><span>Atualizar</span></button><button onClick={() => {setEditing(false);setNewTitle("");setNewFunder("");setNewCategory("");setNewDeadline("");setFormOpen(true)}} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><CirclePlus size={17}/> Novo edital</button></div></header>
    {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18}/><div><strong>Falha ao carregar o módulo.</strong><p>{error}</p><p className="mt-1">Confirme que a migração desta branch foi aplicada em homologação e que seu usuário está vinculado a um integrante com acesso administrativo.</p></div></div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Oportunidades ativas", editais.filter(e=>!['encerrado','inscrito'].includes(e.status)).length, "text-emerald-700"],["Prazos nos próximos 7 dias", dueSoon, "text-amber-700"],["Tarefas em aberto", openTasks, "text-sky-700"],["Tarefas atrasadas", lateTasks, "text-rose-700"]].map(([label,value,color])=><article key={String(label)} className="rounded-2xl border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p></article>)}</section>
    <div className="grid gap-5 xl:grid-cols-[minmax(290px,0.8fr)_minmax(0,1.7fr)]">
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="space-y-3 border-b p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Oportunidades</h2><span className="text-xs text-muted-foreground">{filtered.length}</span></div><label className="flex items-center gap-2 rounded-lg border px-3"><Search size={15} className="text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar edital" className="w-full py-2 text-sm outline-none"/></label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm"><option value="all">Todas as situações</option>{Object.entries(STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><div className="divide-y">{loading?<div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando oportunidades…</div>:filtered.length?filtered.map(e=><button key={e.id} onClick={()=>{setSelectedId(e.id);setOpinion(e.eligibility_opinion||"")}} className={`w-full p-4 text-left transition hover:bg-emerald-50/70 ${e.id===selectedId?"bg-emerald-50 ring-inset ring-2 ring-emerald-600":""}`}><div className="flex items-start justify-between gap-2"><span className="font-mono text-xs font-semibold text-emerald-800">{e.protocol}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{STATUS[e.status]||e.status}</span></div><h3 className="mt-2 font-semibold leading-snug">{e.title}</h3><p className="mt-1 text-sm text-muted-foreground">{e.funder}</p><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays size={13}/>{dateLabel(e.deadline)}</p></button>):<div className="p-7 text-center text-sm text-muted-foreground">Nenhuma oportunidade encontrada.</div>}</div></section>
      <section className="min-w-0 space-y-4">{selected?<>
        <article className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold text-emerald-800">{selected.protocol}</p><h2 className="mt-1 text-xl font-bold">{selected.title}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.funder} · {selected.category}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{STATUS[selected.status]||selected.status}</span><button onClick={()=>{setEditing(true);setNewTitle(selected.title);setNewFunder(selected.funder);setNewCategory(selected.category);setNewDeadline(selected.deadline||"");setFormOpen(true)}} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Editar</button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Prazo</p><p className="mt-1 font-semibold">{dateLabel(selected.deadline)}</p></div><div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Elegibilidade</p><p className="mt-1 font-semibold">{selected.eligibility_status === "approved"?"Aprovada":selected.eligibility_status === "not_eligible"?"Não elegível":"Pendente de verificação"}</p></div></div></article>
        <article className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Elegibilidade e parecer</h3><p className="mt-1 text-xs text-muted-foreground">Registre os critérios oficiais antes de recomendar avanço.</p></div><ShieldCheck className="text-emerald-700"/></div><div className="mt-4 space-y-2">{selectedRequirements.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span className="text-sm">{r.description}</span><select aria-label={`Situação do requisito ${r.description}`} value={r.status} onChange={e=>void updateRequirement(r,e.target.value as Requirement["status"])} className="rounded-md border bg-background px-2 py-1 text-xs"><option value="pending">A verificar</option><option value="met">Atendido</option><option value="not_met">Não atendido</option></select></div>)}{!selectedRequirements.length&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Critérios oficiais ainda não registrados. O edital permanece pendente de confirmação.</p>}</div><form onSubmit={addRequirement} className="mt-3 flex gap-2"><input value={requirementText} onChange={e=>setRequirementText(e.target.value)} placeholder="Adicionar requisito oficial verificado" className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"/><button disabled={saving||!requirementText.trim()} className="rounded-lg border px-3 text-sm font-medium disabled:opacity-50">Adicionar</button></form><form onSubmit={saveEligibility} className="mt-4 space-y-2"><textarea value={opinion} onChange={e=>setOpinion(e.target.value)} rows={3} placeholder="Parecer documentado, fontes verificadas e justificativa" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/><button disabled={saving||!opinion.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Registrar parecer</button></form>{selected.eligibility_status==="approved"&&!selected.manager_approved_at&&<div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">Elegibilidade aprovada. A elaboração segue bloqueada até o gestor autorizar o avanço.</p>{canApprove?<button onClick={()=>void approveAdvance()} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Check size={16}/> Aprovar avanço como Felipe</button>:<p className="mt-2 text-xs text-emerald-800">A aprovação está disponível apenas para o gestor Felipe.</p>}</div>}{selected.manager_approved_at&&<p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Avanço aprovado pelo gestor em {new Date(selected.manager_approved_at).toLocaleString("pt-BR")}.</p>}</article>
        <article className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Tarefas do edital</h3><p className="mt-1 text-xs text-muted-foreground">Distribuição compartilhada da análise e das entregas.</p></div><div className="flex gap-2"><select aria-label="Filtrar tarefas por integrante" value={taskFilter} onChange={e=>setTaskFilter(e.target.value)} className="rounded-lg border bg-background px-2 py-2 text-xs"><option value="all">Toda a equipe</option><option value="mine">Minhas tarefas</option>{members.filter(m=>m.id!==myMemberId).map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><select aria-label="Filtrar tarefas por situação" value={taskStatusFilter} onChange={e=>setTaskStatusFilter(e.target.value)} className="rounded-lg border bg-background px-2 py-2 text-xs"><option value="all">Todas situações</option><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select><select aria-label="Filtrar tarefas por prazo" value={taskDueFilter} onChange={e=>setTaskDueFilter(e.target.value)} className="rounded-lg border bg-background px-2 py-2 text-xs"><option value="all">Todos os prazos</option><option value="late">Atrasadas</option><option value="next">Próximos 7 dias</option><option value="none">Sem prazo</option></select><button onClick={()=>setTaskOpen(!taskOpen)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Nova tarefa</button></div></div>{taskOpen&&<form onSubmit={addTask} className="mt-4 grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2"><input required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Título da tarefa" className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-2"/><select required value={taskAssignee} onChange={e=>setTaskAssignee(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm"><option value="">Escolher responsável</option>{members.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm"/><select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm">{Object.entries(PRIORITY).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Salvar tarefa</button></form>}<div className="mt-4 space-y-2">{visibleTasks.length?visibleTasks.map(t=><div key={t.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-semibold">{t.title}</p><p className="text-xs text-muted-foreground">{t.assignee_name||"Sem responsável"} · {dateLabel(t.due_date)} · {PRIORITY[t.priority]||t.priority}</p></div><select aria-label={`Situação de ${t.title}`} value={t.status} onChange={e=>void updateTask(t,{status:e.target.value})} className="rounded-md border bg-background px-2 py-1 text-xs"><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select><select aria-label={`Responsável por ${t.title}`} value={t.assignee_id||""} onChange={e=>void updateTask(t,{assignee_id:e.target.value||null})} className="rounded-md border bg-background px-2 py-1 text-xs"><option value="">Sem responsável</option>{members.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>):<p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">{taskFilter==="mine"?"Você não tem tarefas atribuídas para este edital.":"Nenhuma tarefa corresponde aos filtros selecionados."}</p>}</div></article>
        <article className="rounded-2xl border bg-card p-5 shadow-sm"><h3 className="font-semibold">Documentos e anexos</h3><p className="mt-1 text-xs text-muted-foreground">Arquivos ficam em armazenamento privado e só abrem por link temporário.</p><form onSubmit={uploadAttachment} className="mt-4 flex flex-wrap items-center gap-2"><input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} className="min-w-0 flex-1 text-xs"/><select value={fileCategory} onChange={e=>setFileCategory(e.target.value)} className="rounded-lg border bg-background px-2 py-2 text-xs"><option value="documento">Documento</option><option value="regulamento">Regulamento</option><option value="proposta">Proposta</option><option value="orcamento">Orçamento</option><option value="comprovante">Comprovante</option></select><button disabled={saving||!file} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"><FileUp size={14}/> Anexar</button></form><div className="mt-3 divide-y">{selectedAttachments.map(a=><button key={a.id} onClick={()=>void openAttachment(a)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-emerald-700"><span className="truncate">{a.file_name}</span><span className="text-xs text-muted-foreground">{a.category}</span></button>)}{!selectedAttachments.length&&<p className="py-3 text-sm text-muted-foreground">Nenhum documento anexado.</p>}</div></article>
        <article className="rounded-2xl border bg-card p-5 shadow-sm"><h3 className="font-semibold">Histórico recente</h3><div className="mt-3 divide-y">{audit.filter(a=>a.edital_id===selected.id).slice(0,8).map(a=><div key={a.id} className="py-2 text-sm"><span className="font-medium">{a.actor_name}</span> · {a.action}<p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</p></div>)}{!audit.some(a=>a.edital_id===selected.id)&&<p className="py-2 text-sm text-muted-foreground">As alterações aparecerão aqui.</p>}</div></article>
      </>:<div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">Selecione uma oportunidade para ver detalhes ou cadastre um edital.</div>}</section>
    </div>
    {formOpen&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-edital-title"><form onSubmit={addEdital} className="w-full max-w-lg space-y-4 rounded-2xl bg-background p-6 shadow-xl"><div><h2 id="new-edital-title" className="text-xl font-bold">{editing ? "Editar edital" : "Cadastrar oportunidade"}</h2><p className="mt-1 text-sm text-muted-foreground">{editing ? `Protocolo ${selected?.protocol}` : "O protocolo será gerado automaticamente. A elegibilidade inicia pendente."}</p></div><input required value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Nome do edital" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/><input required value={newFunder} onChange={e=>setNewFunder(e.target.value)} placeholder="Instituição / financiador" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Categoria / linha" className="w-full rounded-lg border bg-background px-3 py-2 text-sm"/><label className="block text-sm">Prazo confirmado (deixe vazio se ainda não verificado)<input type="date" value={newDeadline} onChange={e=>setNewDeadline(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2"/></label><div className="flex justify-end gap-2"><button type="button" onClick={()=>{setFormOpen(false);setEditing(false)}} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">{editing ? "Salvar alterações" : "Cadastrar"}</button></div></form></div>}
  </div>;
}
