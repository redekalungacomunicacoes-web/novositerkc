import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HandCoins, ShieldCheck, Loader2, WalletCards } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FINANCE_MODULE_ROLES, getCurrentUserRoles, hasAnyRole } from "@/lib/rbac";

const money = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type Project = {id:string;name:string;status:string;initial_amount:number;current_balance:number;funder:string|null};
type Movement = {id:string;project_id:string;title:string;date:string;total_value:number;status:string};
export function CaptacaoRepasses() {
  const [projects,setProjects]=useState<Project[]>([]);
  const [movements,setMovements]=useState<Movement[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [project,setProject]=useState("all");
  useEffect(()=>{let active=true; void (async()=>{
    try {
      const {roles}=await getCurrentUserRoles();
      if(!hasAnyRole(roles,FINANCE_MODULE_ROLES)) throw new Error("Seu perfil não tem acesso ao módulo financeiro.");
      const [p,m]=await Promise.all([
        supabase.from("finance_projects").select("id,name,status,initial_amount,current_balance,funder").order("name"),
        supabase.from("finance_movements").select("id,project_id,title,date,total_value,status").eq("type","entrada").not("project_id","is",null).order("date",{ascending:false})
      ]);
      if(p.error||m.error) throw p.error||m.error;
      if(active){setProjects(p.data||[]);setMovements(m.data||[]);}
    }catch(e){if(active)setError((e as Error).message);}finally{if(active)setLoading(false);}
  })();return()=>{active=false;};},[]);
  const visible=movements.filter(m=>project==="all"||m.project_id===project);
  return <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 dark:bg-card">
    <h2 className="flex items-center gap-2 text-xl font-bold"><HandCoins size={22}/>Repasses dos projetos</h2>
    <p className="text-sm text-muted-foreground">Entradas registradas no Financeiro, com seus projetos de origem. Os cadastros atuais não possuem vínculo direto entre projeto financeiro e edital.</p>
    {loading?<p role="status"><Loader2 className="inline animate-spin"/> Carregando repasses…</p>:error?<p role="alert" className="text-sm text-rose-700">{error}</p>:<>
      <label className="block text-sm">Projeto<select aria-label="Projeto dos repasses" value={project} onChange={e=>setProject(e.target.value)} className="mt-2 block w-full rounded-xl border bg-background p-3"><option value="all">Todos os projetos financeiros</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">{[ ["Recebido",visible.filter(m=>m.status==="pago").reduce((n,m)=>n+Number(m.total_value),0)],["Pendente",visible.filter(m=>m.status==="pendente").reduce((n,m)=>n+Number(m.total_value),0)] ].map(([label,value])=><article key={label} className="rounded-xl border bg-background p-4"><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-2 block text-2xl">{money(Number(value))}</strong></article>)}</div>
      <div className="grid gap-3 md:grid-cols-2">{projects.filter(p=>project==="all"||p.id===project).map(p=><Link key={p.id} to={`/admin/financeiro/projetos/${p.id}`} className="rounded-xl border bg-background p-4"><h3 className="flex items-center gap-2 font-semibold"><WalletCards size={18}/>{p.name}</h3><p className="mt-2 text-sm">{p.status.replaceAll("_"," ")} · {p.funder||"Financiador não informado"}</p><p className="mt-1 text-xs text-muted-foreground">Valor inicial: {money(p.initial_amount)} · Saldo: {money(p.current_balance)}</p><span className="mt-3 block text-sm font-semibold underline">Abrir projeto e movimentações</span></Link>)}</div>
      <h3 className="font-semibold">Histórico de entradas</h3><div className="divide-y rounded-xl border bg-background px-4">{visible.map(m=><article key={m.id} className="py-3"><p className="font-medium">{m.title||"Entrada"} · {money(m.total_value)}</p><p className="mt-1 text-xs text-muted-foreground">{projects.find(p=>p.id===m.project_id)?.name||"Projeto sem acesso"} · {m.date.split("-").reverse().join("/")} · {m.status}</p></article>)}{!visible.length&&<p className="py-5 text-sm text-muted-foreground">Nenhuma entrada registrada para este filtro.</p>}</div>
    </>}
    <Link to="/admin/financeiro/projetos" className="inline-block rounded-xl border bg-background px-4 py-3 text-sm font-semibold">Gerenciar no Financeiro</Link>
  </section>;
}

type Source={id:string;nome:string;url:string;ativa:boolean};
type Sync={id:number;iniciada_em:string;finalizada_em:string|null;status:string;encontradas:number;novas:number;erro:string|null};
export function CaptacaoGestao(){
  const [sources,setSources]=useState<Source[]>([]),[runs,setRuns]=useState<Sync[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let active=true; void (async()=>{try{
    const [s,r]=await Promise.all([supabase.from("captacao_radar_fontes").select("id,nome,url,ativa").order("nome"),supabase.from("captacao_radar_sincronizacoes").select("id,iniciada_em,finalizada_em,status,encontradas,novas,erro").order("iniciada_em",{ascending:false}).limit(30)]);
    if(s.error||r.error)throw s.error||r.error;
    if(active){setSources(s.data||[]);setRuns(r.data||[]);}
  }catch(e){if(active)setError((e as Error).message);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[]);
  return <section className="space-y-5 rounded-2xl border bg-slate-50/50 p-5 dark:bg-card"><h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck size={22}/>Gestão do Radar</h2>
    <p className="text-sm text-muted-foreground">Coleta diária programada para 06h15, horário de Brasília. O resultado de cada execução aparece abaixo.</p>
    <a href="https://github.com/redekalungacomunicacoes-web/novositerkc/actions/workflows/radar-editais-diario.yml" target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl border bg-background px-4 py-3 text-sm font-semibold">Ver execução da automação no GitHub</a>
    {loading?<p role="status">Carregando gestão…</p>:error?<p role="alert" className="text-rose-700">{error}</p>:<>
      <div className="rounded-xl border bg-background p-4"><h3 className="font-bold">Fontes de monitoramento</h3><div className="mt-3 divide-y">{sources.map(s=><div key={s.id} className="py-3"><a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-semibold underline">{s.nome}</a><span className="ml-2 rounded-full bg-muted px-2 py-1 text-xs">{s.ativa?"Ativa":"Inativa"}</span></div>)}{!sources.length&&<p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>}</div></div>
      <div className="rounded-xl border bg-background p-4"><h3 className="font-bold">Últimas 30 coletas</h3><div className="mt-3 divide-y">{runs.map(r=><article key={r.id} className="py-3"><p className="text-sm font-semibold">{new Date(r.iniciada_em).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} · {r.status}</p><p className="mt-1 text-xs text-muted-foreground">{r.encontradas} encontradas · {r.novas} novas · {r.finalizada_em?"Finalizada":"Sem término registrado"}</p>{r.erro&&<p className="mt-2 break-words text-xs text-rose-700">{r.erro}</p>}</article>)}{!runs.length&&<p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>}</div></div>
    </>}
  </section>;
}
