import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useFinance } from "./hooks/useFinance";
import { Category, Movement, Project, Tag } from "./types/financial";
import { KPICard } from "./components/KPICard";
import { MovementModal } from "./components/MovementModal";
import { CashFlowTab } from "./tabs/CashFlowTab";
import { AccountabilityTab } from "./tabs/AccountabilityTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { SettingsTab } from "./tabs/SettingsTab";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function FinanceiroProjeto() {
  const { id = "" } = useParams();
  const finance = useFinance();
  const [project, setProject] = useState<Project | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState<Movement | null>(null);

  const load = async () => {
    const [p, m, c, t] = await Promise.all([finance.getProject(id), finance.listMovements(id), finance.listCategories(), finance.listTags()]);
    if (p.data) setProject(p.data);
    if (m.data) setMovements(m.data);
    if (c.data) setCategories(c.data);
    if (t.data) setTags(t.data);
  };

  useEffect(() => { load(); }, [id]);

  const totals = useMemo(() => {
    const entradas = movements.filter((m) => m.status === "pago" && m.type === "entrada").reduce((a, m) => a + Number(m.total_value), 0);
    const saidas = movements.filter((m) => m.status === "pago" && m.type === "saida").reduce((a, m) => a + Number(m.total_value), 0);
    const pend = movements.filter((m) => m.status === "pendente");
    return { entradas, saidas, pendCount: pend.length, pendValue: pend.reduce((a, m) => a + Number(m.total_value), 0) };
  }, [movements]);

  if (!project) return <p>Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><Link to="/admin/financeiro" className="text-sm text-blue-600">← Voltar</Link><h1 className="text-2xl font-bold">{project.name}</h1></div>
        <button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={() => { setSelected(null); setOpenModal(true); }}>Nova movimentação</button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <KPICard title="Saldo atual" value={brl.format(Number(project.current_balance))} />
        <KPICard title="Entradas pagas" value={brl.format(totals.entradas)} />
        <KPICard title="Saídas pagas" value={brl.format(totals.saidas)} />
        <KPICard title="Pendências" value={`${totals.pendCount} (${brl.format(totals.pendValue)})`} />
      </div>
      <Tabs defaultValue="caixa">
        <TabsList><TabsTrigger value="caixa">Caixa</TabsTrigger><TabsTrigger value="prestacao">Prestação</TabsTrigger><TabsTrigger value="relatorios">Relatórios</TabsTrigger><TabsTrigger value="config">Configurações</TabsTrigger></TabsList>
        <TabsContent value="caixa"><CashFlowTab movements={movements} onEdit={(m) => { setSelected(m); setOpenModal(true); }} onDelete={async (m) => { if (confirm("Excluir movimentação?")) { await finance.deleteMovement(m.id); load(); } }} /></TabsContent>
        <TabsContent value="prestacao"><AccountabilityTab movements={movements} /></TabsContent>
        <TabsContent value="relatorios"><ReportsTab project={project} movements={movements} /></TabsContent>
        <TabsContent value="config"><SettingsTab categories={categories} tags={tags} onSave={async (nextC, nextT) => { await finance.upsertCategories(nextC); await finance.upsertTags(nextT); load(); }} /></TabsContent>
      </Tabs>
      <MovementModal open={openModal} onOpenChange={setOpenModal} projectId={project.id} movement={selected} categories={categories} tags={tags} onSaved={load} />
    </div>
  );
}
