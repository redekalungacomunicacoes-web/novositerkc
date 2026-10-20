import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, BadgeCheck, CalendarClock, CalendarDays, Check, CircleDot, CirclePlus, ClipboardCheck, FileCheck2, FileUp, ExternalLink, Eye, Link2, X, FolderKanban, HandCoins, History, LayoutDashboard, ListChecks, Loader2, RefreshCw, Search, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Edital = { id: string; protocol: string; title: string; funder: string; category: string; deadline: string | null; status: string; eligibility_status: string; eligibility_opinion: string | null; manager_approved_at: string | null; created_at: string };
type Requirement = { id: string; edital_id: string; description: string; status: "pending" | "met" | "not_met"; evidence: string | null };
type Task = { id: string; edital_id: string; title: string; assignee_id: string | null; assignee_name?: string; due_date: string | null; priority: string; status: string };
type Member = { id: string; nome: string; user_id?: string | null };
type Attachment = { id: string; edital_id: string; file_name: string; storage_path: string | null; external_url?: string | null; category: string; created_at: string };
type AttachmentPreview = { attachment: Attachment; url: string; kind: "image" | "pdf" | "document" | "link" };
type Audit = { id: string; actor_name: string; action: string; entity: string; edital_id: string; created_at: string; detail: string };
const STATUS: Record<string, string> = { pending_confirmation: "Pendente de confirmação", pending_eligibility: "Aguardando análise", em_elaboracao: "Em elaboração", inscrito: "Inscrição enviada", aguardando_avaliacao: "Aguardando avaliação", encerrado: "Encerrado" };
const PRIORITY: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
const dateLabel = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Prazo a confirmar";
const statusTone = (status: string) => status === "pending_confirmation" ? "border-amber-300 bg-amber-100 text-amber-950" : status === "pending_eligibility" ? "border-violet-300 bg-violet-100 text-violet-950" : status === "em_elaboracao" ? "border-sky-300 bg-sky-100 text-sky-950" : status === "inscrito" ? "border-emerald-300 bg-emerald-100 text-emerald-950" : status === "aguardando_avaliacao" ? "border-orange-300 bg-orange-100 text-orange-950" : "border-slate-300 bg-slate-100 text-slate-700";
const statusCardTone = (status: string) => status === "pending_confirmation" ? "border-amber-300 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-50" : status === "pending_eligibility" ? "border-violet-300 bg-violet-50/80 hover:border-violet-400 hover:bg-violet-50" : status === "em_elaboracao" ? "border-sky-300 bg-sky-50/80 hover:border-sky-400 hover:bg-sky-50" : status === "inscrito" ? "border-emerald-300 bg-emerald-50/80 hover:border-emerald-400 hover:bg-emerald-50" : status === "aguardando_avaliacao" ? "border-orange-300 bg-orange-50/80 hover:border-orange-400 hover:bg-orange-50" : "border-slate-300 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-50";

export function AdminCaptacao() {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detailTab, setDetailTab] = useState<"overview" | "eligibility" | "tasks" | "documents" | "history">("overview");
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
  const [newStatus, setNewStatus] = useState("pending_confirmation");
  const [requirementText, setRequirementText] = useState("");
  const [opinion, setOpinion] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskPriority, setTaskPriority] = useState("media");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileCategory, setFileCategory] = useState("documento");
  const [attachmentMode, setAttachmentMode] = useState<"file" | "link">("file");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const [{ data: ed, error: ee }, { data: req, error: re }, { data: ts, error: te }, { data: team, error: me }, { data: files, error: fe }, user] = await Promise.all([
        supabase.from("captacao_editais").select("*").order("deadline", { ascending: true, nullsFirst: false }),
        supabase.from("captacao_requisitos").select("*").order("created_at"),
        supabase.from("captacao_tarefas").select("id,edital_id,title,assignee_id,due_date,priority,status,assignee:equipe!captacao_tarefas_assignee_id_fkey(nome)").order("due_date", { ascending: true, nullsFirst: false }),
        supabase.from("equipe").select("id,nome,user_id,ativo").eq("ativo", true).order("nome"),
        supabase.from("captacao_anexos").select("*").order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);
      const firstError = ee || re || te || me || fe;
      if (firstError) throw firstError;
      const current = user.data.user?.id;
      const member = (team || []).find((m: any) => m.user_id === current);
      setEditais((ed || []) as Edital[]); setRequirements((req || []) as Requirement[]);
      setTasks((ts || []).map((t: any) => ({ ...t, assignee_name: Array.isArray(t.assignee) ? t.assignee[0]?.nome : t.assignee?.nome })) as Task[]);
      setMembers((team || []) as Member[]); setAttachments((files || []) as Attachment[]);
      setMyMemberId(member?.id || ""); setCanApprove(Boolean(member && member.nome.trim().toLocaleLowerCase("pt-BR") === "felipe"));
      setSelectedId((old) => routeId || ((ed || []).some((x: Edital) => x.id === old) ? old : (ed?.[0]?.id || "")));
    } catch (e) { setError((e as Error).message || "Não foi possível carregar o módulo."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!routeId) return;
    setSelectedId(routeId);
    setOpinion(editais.find((item) => item.id === routeId)?.eligibility_opinion || "");
    setDetailTab("overview");
  }, [routeId, editais]);
  useEffect(() => {
    if (!selectedId) { setAudit([]); return; }
    let active = true;
    void supabase.from("captacao_auditoria")
      .select("id,actor_name,action,entity,edital_id,created_at,detail")
      .eq("edital_id", selectedId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error: auditError }) => {
        if (!active) return;
        if (auditError) { setAudit([]); return; }
        setAudit((data || []) as Audit[]);
      });
    return () => { active = false; };
  }, [selectedId]);

  const selected = editais.find((e) => e.id === (routeId || selectedId)) || null;
  const filtered = useMemo(() => editais.filter((e) => (statusFilter === "all" || e.status === statusFilter) && `${e.protocol} ${e.title} ${e.funder}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [editais, statusFilter, query]);
  const today = new Date().toISOString().slice(0, 10);
  const myTasks = taskFilter === "all" ? tasks : tasks.filter((t) => t.assignee_id === (taskFilter === "mine" ? myMemberId : taskFilter));
  const visibleTasks = myTasks.filter((t) => t.edital_id === selectedId)
    .filter((t) => taskStatusFilter === "all" || t.status === taskStatusFilter)
    .filter((t) => taskDueFilter === "all" || (taskDueFilter === "late" ? Boolean(t.due_date && t.due_date < today && t.status !== "concluida") : taskDueFilter === "next" ? Boolean(t.due_date && t.due_date >= today && t.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)) : !t.due_date));
  const selectedRequirements = requirements.filter((r) => r.edital_id === selectedId);
  const selectedAttachments = attachments.filter((a) => a.edital_id === selectedId);
  const lateTasks = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "concluida").length;
  const dueSoon = editais.filter((e) => e.deadline && e.deadline >= today && (new Date(`${e.deadline}T12:00:00`).getTime() - Date.now()) < 8 * 86400000 && !["encerrado", "inscrito", "aguardando_avaliacao"].includes(e.status)).length;
  const openTasks = tasks.filter((t) => t.status !== "concluida").length;

  async function addEdital(event: React.FormEvent) {
    event.preventDefault(); if (!newTitle.trim() || !newFunder.trim()) return;
    setSaving(true);
    try {
      const payload = { title: newTitle.trim(), funder: newFunder.trim(), category: newCategory.trim() || "Não informado", deadline: newDeadline || null };
      const result = editing && selected ? await supabase.from("captacao_editais").update({ ...payload, status: newStatus }).eq("id", selected.id) : await supabase.from("captacao_editais").insert({ ...payload, status: "pending_confirmation", eligibility_status: "pending_verification" });
      if (result.error) throw result.error; toast.success(editing ? "Edital atualizado." : "Oportunidade cadastrada para confirmação."); setFormOpen(false); setEditing(false); setNewTitle(""); setNewFunder(""); setNewCategory(""); setNewDeadline(""); setNewStatus("pending_confirmation"); await load();
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
    try { const { error: e } = await supabase.from("captacao_tarefas").insert({ edital_id: selected.id, title: taskTitle.trim(), assignee_id: taskAssignee, due_date: taskDue || null, priority: taskPriority, status: "pendente", created_by: myMemberId || null }); if (e) throw e; setTaskTitle(""); setTaskDue(""); setTaskOpen(false); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function updateTask(task: Task, patch: Partial<Task>) { const { error: e } = await supabase.from("captacao_tarefas").update(patch).eq("id", task.id); if (e) toast.error(e.message); else await load(); }
  async function uploadAttachment(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !file) return; setSaving(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const storagePath = `${selected.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("captacao-editais").upload(storagePath, file, { upsert: false, contentType: file.type || "application/octet-stream" }); if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("captacao_anexos").insert({ edital_id: selected.id, file_name: file.name, storage_path: storagePath, category: fileCategory, uploaded_by: myMemberId || null });
      if (insertError) { await supabase.storage.from("captacao-editais").remove([storagePath]); throw insertError; }
      setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; await load(); toast.success("Arquivo privado anexado ao edital.");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function addAttachmentLink(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !linkTitle.trim() || !linkUrl.trim()) return;
    let parsed: URL;
    try { parsed = new URL(linkUrl.trim()); } catch { toast.error("Informe um link válido."); return; }
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) { toast.error("Use um link http ou https válido."); return; }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from("captacao_anexos").insert({
        edital_id: selected.id, file_name: linkTitle.trim(), storage_path: null,
        external_url: parsed.toString(), category: fileCategory, uploaded_by: myMemberId || null,
      });
      if (insertError) throw insertError;
      setLinkTitle(""); setLinkUrl(""); await load(); toast.success("Link adicionado aos documentos do edital.");
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function openAttachment(item: Attachment) {
    if (item.external_url) { setAttachmentPreview({ attachment: item, url: item.external_url, kind: "link" }); return; }
    if (!item.storage_path) { toast.error("Este documento não tem um arquivo associado."); return; }
    const { data, error: signedUrlError } = await supabase.storage.from("captacao-editais").createSignedUrl(item.storage_path, 600);
    if (signedUrlError) { toast.error(signedUrlError.message); return; }
    const name = item.file_name.toLocaleLowerCase("pt-BR");
    const kind = /\\.(png|jpe?g|gif|webp|avif)$/i.test(name) ? "image" : /\\.pdf$/i.test(name) ? "pdf" : "document";
    setAttachmentPreview({ attachment: item, url: data.signedUrl, kind });
  }

  const activeOpportunities = editais.filter((e) => !["encerrado", "inscrito", "aguardando_avaliacao"].includes(e.status)).length;
  const awaitingEvaluation = editais.filter((e) => e.status === "aguardando_avaliacao").length;

  return <div className="space-y-8 pb-6">
    <header className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-teal-50/90 p-6 shadow-sm dark:from-card dark:via-card dark:to-emerald-950/20 md:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex max-w-2xl gap-4">
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-900/15 sm:flex"><HandCoins size={27}/></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Rede Kalunga <span className="mx-1 text-emerald-400">/</span> Administração</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-foreground md:text-4xl">Captação de recursos</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-muted-foreground">Acompanhe oportunidades, inscrições, prazos e entregas da equipe em um só lugar.</p></div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto"><button onClick={() => void load()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/80 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white sm:flex-none dark:border-border dark:bg-card" aria-label="Atualizar painel"><RefreshCw size={16}/><span>Atualizar</span></button><button onClick={() => {setEditing(false);setNewTitle("");setNewFunder("");setNewCategory("");setNewDeadline("");setNewStatus("pending_confirmation");setFormOpen(true)}} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-950/10 transition hover:bg-emerald-900 sm:flex-none"><CirclePlus size={17}/> Novo edital</button></div>
      </div>
    </header>

    {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={19} className="mt-0.5 shrink-0"/><div><strong>Não foi possível carregar o painel.</strong><p className="mt-1">{error}</p><p className="mt-2 text-xs">Confira se seu usuário tem acesso administrativo e se as migrações do módulo estão aplicadas.</p></div></div>}

    {!routeId && <>
    <section aria-label="Resumo da captação" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Oportunidades abertas</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><FolderKanban size={19}/></span></div><div className="mt-3 flex items-end justify-between"><strong className="text-3xl font-bold tracking-tight">{activeOpportunities}</strong><span className="pb-1 text-xs text-muted-foreground">em acompanhamento</span></div></article>
      <article className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Aguardando avaliação</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><CalendarClock size={19}/></span></div><div className="mt-3 flex items-end justify-between"><strong className="text-3xl font-bold tracking-tight">{awaitingEvaluation}</strong><span className="pb-1 text-xs text-muted-foreground">inscrições enviadas</span></div></article>
      <article className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Tarefas em aberto</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><ListChecks size={19}/></span></div><div className="mt-3 flex items-end justify-between"><strong className="text-3xl font-bold tracking-tight">{openTasks}</strong><span className="pb-1 text-xs text-muted-foreground">da equipe</span></div></article>
      <article className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Tarefas atrasadas</span><span className={"flex h-10 w-10 items-center justify-center rounded-xl " + (lateTasks ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-500")}><CalendarDays size={19}/></span></div><div className="mt-3 flex items-end justify-between"><strong className={"text-3xl font-bold tracking-tight " + (lateTasks ? "text-rose-700" : "")}>{lateTasks}</strong><span className="pb-1 text-xs text-muted-foreground">precisam de atenção</span></div></article>
    </section>

    <section className="space-y-4" aria-labelledby="opportunities-heading">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><FolderKanban size={18}/></span><h2 id="opportunities-heading" className="text-xl font-bold tracking-tight">Carteira de editais</h2></div><p className="mt-2 text-sm text-muted-foreground">Selecione uma oportunidade para ver etapas, tarefas e documentos.</p></div><span className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">{filtered.length} {filtered.length === 1 ? "oportunidade" : "oportunidades"}</span></div>
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background px-3 text-muted-foreground"><Search size={16}/><input aria-label="Buscar edital" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por edital, financiador ou protocolo" className="w-full py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"/></label>
        <label className="flex items-center gap-2 rounded-xl border bg-background px-3 text-muted-foreground"><CircleDot size={15}/><select aria-label="Filtrar por situação" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="min-w-40 bg-transparent py-2.5 text-sm text-foreground outline-none"><option value="all">Todas as situações</option>{Object.entries(STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <div aria-label="Legenda das situações" className="flex flex-wrap gap-2">
        <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">Aguardando confirmação</span>
        <span className="rounded-full border border-violet-300 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-950">Aguardando análise</span>
        <span className="rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-950">Em elaboração</span>
        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-950">Inscrição enviada</span>
        <span className="rounded-full border border-orange-300 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-950">Aguardando avaliação</span>
        <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Encerrado</span>
      </div>
      {loading ? <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando oportunidades…</div> : filtered.length ? <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{filtered.map(e => <button key={e.id} type="button" aria-label={`Abrir ${e.title}, ${STATUS[e.status] || e.status}`} onClick={()=>{setSelectedId(e.id);setOpinion(e.eligibility_opinion||"");setDetailTab("overview");navigate(`/admin/editais/${e.id}`)}} className={"group rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 " + statusCardTone(e.status)}>
        <div className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-slate-700"><ClipboardCheck size={13}/>{e.protocol}</span><span className={"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold " + statusTone(e.status)}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{STATUS[e.status]||e.status}</span></div>
        <h3 className="mt-4 line-clamp-2 font-semibold leading-6 text-foreground group-hover:text-emerald-800">{e.title}</h3><p className="mt-1 text-sm text-muted-foreground">{e.funder}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/70 px-2 py-1.5"><WalletCards size={14}/>{e.category}</span><span className="inline-flex items-center gap-1.5 px-1 py-1.5"><CalendarDays size={14}/>{dateLabel(e.deadline)}</span></div>
      </button>)}</div> : <div className="rounded-2xl border border-dashed bg-card p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Search size={20}/></div><p className="mt-3 font-semibold">Nenhum edital encontrado</p><p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou o filtro de situação.</p></div>}
    </section>
    </>}

    {routeId ? selected ? <section aria-labelledby="selected-edital-heading" className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="border-b bg-muted/20 px-4 py-3"><button type="button" onClick={()=>navigate("/admin/editais")} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"><ArrowLeft size={16}/> Voltar para oportunidades</button></div>
      <div className="border-b bg-gradient-to-r from-emerald-50/90 via-white to-white p-5 dark:from-emerald-950/30 dark:via-card dark:to-card md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3"><div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-white sm:flex"><FileCheck2 size={21}/></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-900 shadow-sm dark:bg-card"><ClipboardCheck size={14}/>{selected.protocol}</span><span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold " + statusTone(selected.status)}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{STATUS[selected.status]||selected.status}</span></div><h2 id="selected-edital-heading" className="mt-3 text-xl font-bold leading-tight tracking-tight md:text-2xl">{selected.title}</h2><p className="mt-1.5 text-sm text-muted-foreground">{selected.funder}<span className="mx-2 text-muted-foreground/50">•</span>{selected.category}</p></div></div>
          <button onClick={()=>{setEditing(true);setNewTitle(selected.title);setNewFunder(selected.funder);setNewCategory(selected.category);setNewDeadline(selected.deadline||"");setNewStatus(selected.status);setFormOpen(true)}} className="inline-flex items-center gap-2 rounded-xl border bg-white/90 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white dark:bg-card"><Check size={15}/> Editar edital</button>
        </div>
        <nav aria-label="Seções do edital" className="-mx-1 mt-6 flex gap-1 overflow-x-auto border-b border-emerald-900/10 px-1">
          <button type="button" aria-current={detailTab==="overview"?"page":undefined} onClick={()=>setDetailTab("overview")} className={"inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition " + (detailTab==="overview"?"border-emerald-700 text-emerald-800":"border-transparent text-muted-foreground hover:text-foreground")}><LayoutDashboard size={16}/>Visão geral</button>
          <button type="button" aria-current={detailTab==="eligibility"?"page":undefined} onClick={()=>setDetailTab("eligibility")} className={"inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition " + (detailTab==="eligibility"?"border-emerald-700 text-emerald-800":"border-transparent text-muted-foreground hover:text-foreground")}><ShieldCheck size={16}/>Elegibilidade</button>
          <button type="button" aria-current={detailTab==="tasks"?"page":undefined} onClick={()=>setDetailTab("tasks")} className={"inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition " + (detailTab==="tasks"?"border-emerald-700 text-emerald-800":"border-transparent text-muted-foreground hover:text-foreground")}><ListChecks size={16}/>Tarefas<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{tasks.filter(t=>t.edital_id===selected.id).length}</span></button>
          <button type="button" aria-current={detailTab==="documents"?"page":undefined} onClick={()=>setDetailTab("documents")} className={"inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition " + (detailTab==="documents"?"border-emerald-700 text-emerald-800":"border-transparent text-muted-foreground hover:text-foreground")}><FileCheck2 size={16}/>Documentos<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{selectedAttachments.length}</span></button>
          <button type="button" aria-current={detailTab==="history"?"page":undefined} onClick={()=>setDetailTab("history")} className={"inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition " + (detailTab==="history"?"border-emerald-700 text-emerald-800":"border-transparent text-muted-foreground hover:text-foreground")}><History size={16}/>Histórico</button>
        </nav>
      </div>

      <div className="p-4 md:p-6">
        {detailTab==="overview" && <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-2xl border bg-background p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CircleDot size={15}/>Etapa atual</div><p className="mt-2 font-semibold">{STATUS[selected.status]||selected.status}</p><p className="mt-1 text-xs text-muted-foreground">Situação registrada para esta oportunidade.</p></article>
            <article className="rounded-2xl border bg-background p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CalendarDays size={15}/>Prazo informado</div><p className="mt-2 font-semibold">{dateLabel(selected.deadline)}</p><p className="mt-1 text-xs text-muted-foreground">{selected.deadline?"Confira a fonte oficial antes de tomar decisões.":"Ainda não confirmado."}</p></article>
            <article className="rounded-2xl border bg-background p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck size={15}/>Elegibilidade</div><p className="mt-2 font-semibold">{selected.eligibility_status === "approved"?"Aprovada":selected.eligibility_status === "not_eligible"?"Não elegível":"Pendente de verificação"}</p><p className="mt-1 text-xs text-muted-foreground">A aprovação exige requisitos e parecer documentados.</p></article>
          </div>
          {selected.eligibility_opinion && <article className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/20"><div className="flex items-center gap-2 text-sm font-semibold text-sky-900 dark:text-sky-200"><ClipboardCheck size={17}/>Registro da equipe</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-sky-950/90 dark:text-sky-100/90">{selected.eligibility_opinion}</p></article>}
          {selected.manager_approved_at ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><BadgeCheck size={19} className="mt-0.5 shrink-0"/><div><strong>Avanço liberado pelo gestor</strong><p className="mt-1">Autorizado em {new Date(selected.manager_approved_at).toLocaleString("pt-BR")}.</p></div></div> : selected.eligibility_status==="approved" ? <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldCheck size={19} className="mt-0.5 shrink-0"/><div><strong>Elegibilidade registrada</strong><p className="mt-1">A elaboração segue bloqueada até o gestor autorizar o avanço.</p>{canApprove?<button onClick={()=>void approveAdvance()} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"><Check size={16}/> Autorizar avanço</button>:<p className="mt-2 text-xs">A autorização está disponível apenas para o gestor Felipe.</p>}</div></div> : <div className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-4 text-sm"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-muted-foreground"/><div><strong>Próxima etapa: verificar elegibilidade</strong><p className="mt-1 text-muted-foreground">Registre os requisitos oficiais e o parecer antes de solicitar o avanço.</p><button type="button" onClick={()=>setDetailTab("eligibility")} className="mt-2 text-sm font-semibold text-emerald-800 hover:underline">Abrir análise de elegibilidade →</button></div></div>}
        </div>}

        {detailTab==="eligibility" && <article className="rounded-2xl border bg-background p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><ShieldCheck size={18}/></span><h3 className="text-lg font-bold">Elegibilidade e parecer</h3></div><p className="mt-2 text-sm text-muted-foreground">Registre critérios confirmados no regulamento oficial. Não presuma que a proposta seja elegível.</p></div><span className={"rounded-full border px-2.5 py-1 text-xs font-semibold " + (selected.eligibility_status==="approved"?"border-emerald-200 bg-emerald-50 text-emerald-800":selected.eligibility_status==="not_eligible"?"border-rose-200 bg-rose-50 text-rose-800":"border-amber-200 bg-amber-50 text-amber-800")}>{selected.eligibility_status==="approved"?"Aprovada":selected.eligibility_status==="not_eligible"?"Não elegível":"Em verificação"}</span></div>
          <div className="mt-5 space-y-2">{selectedRequirements.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"><span className="text-sm leading-5">{r.description}</span><select aria-label={`Situação do requisito ${r.description}`} value={r.status} onChange={e=>void updateRequirement(r,e.target.value as Requirement["status"])} className="rounded-lg border bg-background px-3 py-2 text-xs font-medium"><option value="pending">A verificar</option><option value="met">Atendido</option><option value="not_met">Não atendido</option></select></div>)}{!selectedRequirements.length&&<div className="rounded-xl border border-dashed bg-amber-50/70 p-5 text-sm text-amber-900"><strong>Requisitos ainda não registrados</strong><p className="mt-1">Consulte o regulamento e registre cada critério verificado. A elegibilidade permanece pendente.</p></div>}</div>
          <form onSubmit={addRequirement} className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={requirementText} onChange={e=>setRequirementText(e.target.value)} placeholder="Descreva um requisito confirmado" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm"/><button disabled={saving||!requirementText.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><CirclePlus size={16}/>Adicionar requisito</button></form>
          <form onSubmit={saveEligibility} className="mt-5 space-y-2 rounded-2xl bg-muted/40 p-4"><label className="block text-sm font-semibold" htmlFor="eligibility-opinion">Parecer e fonte consultada</label><p className="text-xs text-muted-foreground">Registre a justificativa e os links/documentos oficiais utilizados.</p><textarea id="eligibility-opinion" value={opinion} onChange={e=>setOpinion(e.target.value)} rows={4} placeholder="Ex.: regulamento oficial, item do edital, data de consulta e análise da equipe" className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"/><button disabled={saving||!opinion.trim()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck size={16}/>Salvar parecer</button></form>
        </article>}

        {detailTab==="tasks" && <article className="rounded-2xl border bg-background p-5 md:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><ListChecks size={18}/></span><h3 className="text-lg font-bold">Tarefas do edital</h3></div><p className="mt-2 text-sm text-muted-foreground">Responsáveis, prioridades e prazos das entregas.</p></div><div className="grid gap-2 sm:grid-cols-2 xl:flex"><select aria-label="Filtrar tarefas por integrante" value={taskFilter} onChange={e=>setTaskFilter(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-xs"><option value="all">Toda a equipe</option><option value="mine">Minhas tarefas</option>{members.filter(m=>m.id!==myMemberId).map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><select aria-label="Filtrar tarefas por situação" value={taskStatusFilter} onChange={e=>setTaskStatusFilter(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-xs"><option value="all">Todas situações</option><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select><select aria-label="Filtrar tarefas por prazo" value={taskDueFilter} onChange={e=>setTaskDueFilter(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-xs"><option value="all">Todos os prazos</option><option value="late">Atrasadas</option><option value="next">Próximos 7 dias</option><option value="none">Sem prazo</option></select><button onClick={()=>setTaskOpen(!taskOpen)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 py-2.5 text-xs font-semibold text-white"><CirclePlus size={15}/>Nova tarefa</button></div></div>
          {taskOpen&&<form onSubmit={addTask} className="mt-4 grid gap-2 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2"><input required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Título da tarefa" className="rounded-xl border bg-background px-3 py-2.5 text-sm sm:col-span-2"/><select required value={taskAssignee} onChange={e=>setTaskAssignee(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-sm"><option value="">Escolher responsável</option>{members.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-sm"/><select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-sm">{Object.entries(PRIORITY).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 py-2.5 text-sm font-semibold text-white"><Check size={16}/>Salvar tarefa</button></form>}
          <div className="mt-5 space-y-2">{visibleTasks.length?visibleTasks.map(t=><div key={t.id} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center ${t.status === "concluida" ? "border-emerald-300 bg-emerald-50/80" : t.due_date && t.due_date < today ? "border-rose-300 bg-rose-50/80" : t.status === "em_andamento" ? "border-sky-200 bg-sky-50/70" : "border-amber-200 bg-amber-50/60"}`}><div className="min-w-0"><p className="font-semibold">{t.title}</p><p className="mt-1 text-xs text-muted-foreground">{t.assignee_name||"Sem responsável"} <span className="mx-1">·</span>{dateLabel(t.due_date)} <span className="mx-1">·</span>{PRIORITY[t.priority]||t.priority}</p></div><select aria-label={`Situação de ${t.title}`} value={t.status} onChange={e=>void updateTask(t,{status:e.target.value})} className="rounded-lg border bg-background px-2.5 py-2 text-xs"><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select><select aria-label={`Responsável por ${t.title}`} value={t.assignee_id||""} onChange={e=>void updateTask(t,{assignee_id:e.target.value||null})} className="rounded-lg border bg-background px-2.5 py-2 text-xs"><option value="">Sem responsável</option>{members.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>):<p className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">{taskFilter==="mine"?"Você não tem tarefas atribuídas para este edital.":"Nenhuma tarefa corresponde aos filtros selecionados."}</p>}</div>
        </article>}

        {detailTab==="documents" && <article className="rounded-2xl border bg-background p-5 md:p-6">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-800"><FileCheck2 size={18}/></span><div><h3 className="text-lg font-bold">Documentos e anexos</h3><p className="mt-1 text-sm text-muted-foreground">Arquivos privados e links de referência, visíveis somente à equipe autorizada.</p></div></div>
          <div className="mt-5 inline-flex rounded-xl border bg-muted/40 p-1" role="tablist" aria-label="Tipo de documento para adicionar">
            <button type="button" role="tab" aria-selected={attachmentMode==="file"} onClick={()=>setAttachmentMode("file")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${attachmentMode==="file"?"bg-white text-emerald-900 shadow-sm dark:bg-card":"text-muted-foreground hover:text-foreground"}`}><FileUp size={15} className="mr-1.5 inline"/>Enviar arquivo</button>
            <button type="button" role="tab" aria-selected={attachmentMode==="link"} onClick={()=>setAttachmentMode("link")} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${attachmentMode==="link"?"bg-white text-emerald-900 shadow-sm dark:bg-card":"text-muted-foreground hover:text-foreground"}`}><Link2 size={15} className="mr-1.5 inline"/>Adicionar link</button>
          </div>
          {attachmentMode==="file" ? <form onSubmit={uploadAttachment} className="mt-3 space-y-3 rounded-2xl border bg-muted/20 p-4">
            <input ref={fileInputRef} type="file" className="sr-only" aria-label="Selecionar arquivo para anexar" onChange={e=>setFile(e.target.files?.[0]||null)}/>
            <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-800"><FileCheck2 size={19}/></span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arquivo</p><p aria-live="polite" className="mt-1 truncate text-sm font-semibold">{file ? file.name : "Nenhum arquivo selecionado"}</p><p className="mt-0.5 text-xs text-muted-foreground">{file ? (file.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : "Selecione o regulamento, proposta, orçamento ou comprovante."}</p></div></div>
              <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={saving} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:bg-card dark:text-foreground"><FileUp size={16}/>{file ? "Trocar arquivo" : "Escolher arquivo"}</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="block text-xs font-semibold text-muted-foreground">Categoria do documento<select value={fileCategory} onChange={e=>setFileCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-normal text-foreground"><option value="documento">Documento</option><option value="regulamento">Regulamento</option><option value="proposta">Proposta</option><option value="orcamento">Orçamento</option><option value="comprovante">Comprovante</option></select></label>
              <button type="submit" disabled={saving||!file} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300">{saving ? <><Loader2 size={16} className="animate-spin"/>Enviando…</> : <><FileUp size={16}/>Enviar arquivo</>}</button>
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">{file ? "Arquivo pronto. Confira a categoria e clique em “Enviar arquivo”." : "Primeiro escolha um arquivo. O envio será habilitado em seguida."}</p>
          </form> : <form onSubmit={addAttachmentLink} className="mt-3 grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted-foreground">Nome para identificar o link<input required value={linkTitle} onChange={e=>setLinkTitle(e.target.value)} placeholder="Ex.: Proposta no Google Docs" className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-normal text-foreground"/></label>
            <label className="text-xs font-semibold text-muted-foreground">Link do documento<input required type="url" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://docs.google.com/..." className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-normal text-foreground"/></label>
            <label className="text-xs font-semibold text-muted-foreground">Categoria<select value={fileCategory} onChange={e=>setFileCategory(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-normal text-foreground"><option value="documento">Documento</option><option value="regulamento">Regulamento</option><option value="proposta">Proposta</option><option value="orcamento">Orçamento</option><option value="comprovante">Comprovante</option></select></label>
            <div className="flex flex-col justify-end gap-2"><button disabled={saving||!linkTitle.trim()||!linkUrl.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving?<><Loader2 size={16} className="animate-spin"/>Salvando…</>:<><Link2 size={16}/>Salvar link</>}</button><p className="text-xs text-muted-foreground">O link fica restrito à equipe do painel; as permissões do Google Docs/Drive continuam valendo.</p></div>
          </form>}
          <div className="mt-4 divide-y rounded-xl border px-4">{selectedAttachments.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="flex min-w-0 items-center gap-2 text-sm"><span className="shrink-0 text-violet-700">{a.external_url?<Link2 size={16}/>:<FileCheck2 size={16}/>}</span><span className="min-w-0"><span className="block truncate font-medium">{a.file_name}</span><span className="block text-xs text-muted-foreground">{a.external_url?"Link externo":a.category}</span></span></span><button type="button" onClick={()=>void openAttachment(a)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">{a.external_url?<><ExternalLink size={14}/>Abrir link</>:/\\.(pdf|png|jpe?g|gif|webp|avif)$/i.test(a.file_name)?<><Eye size={14}/>Visualizar</>:<><ExternalLink size={14}/>Abrir arquivo</>}</button></div>)}{!selectedAttachments.length&&<p className="py-5 text-center text-sm text-muted-foreground">Nenhum documento anexado a este edital.</p>}</div>
          <p className="mt-2 text-xs text-muted-foreground">PDFs e imagens têm pré-visualização aqui. DOC/DOCX e outros formatos abrem em uma nova etapa para visualizar ou baixar, conforme o navegador.</p>
        </article>}
{detailTab==="history" && <article className="rounded-2xl border bg-background p-5 md:p-6"><div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><History size={18}/></span><div><h3 className="text-lg font-bold">Histórico de alterações</h3><p className="mt-1 text-sm text-muted-foreground">Acompanhe quem atualizou este edital, as tarefas e os documentos.</p></div></div><div className="mt-5 divide-y rounded-xl border px-4">{audit.filter(a=>a.edital_id===selected.id).slice(0,8).map(a=><div key={a.id} className="flex gap-3 py-3 text-sm"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><History size={15}/></span><div><p><span className="font-semibold">{a.actor_name}</span><span className="mx-1 text-muted-foreground">·</span>{a.action} <span className="text-muted-foreground">{a.entity}</span></p><p className="mt-1 text-xs text-muted-foreground">{a.detail} <span className="mx-1">·</span>{new Date(a.created_at).toLocaleString("pt-BR")}</p></div></div>)}{!audit.some(a=>a.edital_id===selected.id)&&<p className="py-5 text-center text-sm text-muted-foreground">As alterações aparecerão aqui.</p>}</div></article>}
      </div>
    </section> : <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">{loading ? "Carregando edital…" : "Este edital não foi encontrado ou você não tem acesso."}</div> : null}

    {formOpen&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-edital-title"><form onSubmit={addEdital} className="w-full max-w-lg space-y-4 rounded-2xl bg-background p-6 shadow-xl"><div><h2 id="new-edital-title" className="text-xl font-bold">{editing ? "Editar edital" : "Cadastrar oportunidade"}</h2><p className="mt-1 text-sm text-muted-foreground">{editing ? `Protocolo ${selected?.protocol}` : "O protocolo será gerado automaticamente. A elegibilidade inicia pendente."}</p></div><input required value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Nome do edital" className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"/><input required value={newFunder} onChange={e=>setNewFunder(e.target.value)} placeholder="Instituição / financiador" className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"/><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Categoria / linha" className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm"/><label className="block text-sm">Prazo confirmado (deixe vazio se ainda não verificado)<input type="date" value={newDeadline} onChange={e=>setNewDeadline(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5"/></label>{editing&&<label className="block text-sm">Situação<select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5">{Object.entries(STATUS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}<div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={()=>{setFormOpen(false);setEditing(false);setNewStatus("pending_confirmation")}} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={saving} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white">{editing ? "Salvar alterações" : "Cadastrar edital"}</button></div></form></div>}
    {attachmentPreview && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setAttachmentPreview(null)}}><section role="dialog" aria-modal="true" aria-labelledby="attachment-preview-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"><header className="flex items-center justify-between gap-3 border-b px-4 py-3"><div className="min-w-0"><h2 id="attachment-preview-title" className="truncate font-semibold">{attachmentPreview.attachment.file_name}</h2><p className="text-xs text-muted-foreground">{attachmentPreview.kind==="pdf"?"Pré-visualização de PDF":attachmentPreview.kind==="image"?"Pré-visualização de imagem":attachmentPreview.kind==="link"?"Documento hospedado em serviço externo":"Este formato será aberto no navegador"}</p></div><button type="button" aria-label="Fechar pré-visualização" onClick={()=>setAttachmentPreview(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={18}/></button></header><div className="min-h-0 flex-1 bg-slate-100 dark:bg-slate-950">{attachmentPreview.kind==="image"?<div className="flex h-full max-h-[72vh] items-center justify-center overflow-auto p-3"><img src={attachmentPreview.url} alt={attachmentPreview.attachment.file_name} className="max-h-full max-w-full rounded object-contain"/></div>:attachmentPreview.kind==="pdf"?<iframe src={attachmentPreview.url} title={`Pré-visualização de ${attachmentPreview.attachment.file_name}`} className="h-[72vh] w-full border-0"/>:<div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-800">{attachmentPreview.kind==="link"?<Link2 size={22}/>:<FileCheck2 size={22}/>}</span><p className="max-w-xl text-sm text-muted-foreground">{attachmentPreview.kind==="link"?"O link abrirá no serviço de origem e pode exigir acesso da conta correspondente.": "A pré-visualização direta não está disponível para este formato. Você pode abrir ou baixar o documento."}</p><a href={attachmentPreview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">{attachmentPreview.kind==="link"?"Abrir link externo":"Abrir / baixar documento"}<ExternalLink size={15}/></a></div>}</div>{(attachmentPreview.kind==="image"||attachmentPreview.kind==="pdf")&&<footer className="flex justify-end border-t px-4 py-3"><a href={attachmentPreview.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted">Abrir em nova aba<ExternalLink size={15}/></a></footer>}</section></div>}

  </div>;
}
