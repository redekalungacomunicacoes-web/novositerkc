import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFinance } from "./hooks/useFinance";
import { Project } from "./types/financial";
import { KPICard } from "./components/KPICard";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function FinanceiroHome() {
  const finance = useFinance();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pending, setPending] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const p = await finance.listProjects();
      if (p.data) setProjects(p.data as Project[]);
      const top = await finance.listPendingTop();
      if (top.data) setPending(top.data);
    })();
  }, []);

  const kpi = useMemo(() => {
    const initial = projects.reduce((acc, p) => acc + Number(p.initial_amount || 0), 0);
    const balance = projects.reduce((acc, p) => acc + Number(p.current_balance || 0), 0);
    return { totalProjetos: projects.length, initial, balance };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Financeiro</h1>
        <Link to="/admin/financeiro/novo" className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Novo Projeto</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard title="Projetos" value={String(kpi.totalProjetos)} />
        <KPICard title="Valor inicial consolidado" value={brl.format(kpi.initial)} />
        <KPICard title="Saldo consolidado" value={brl.format(kpi.balance)} />
      </div>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-2 text-left">Projeto</th><th className="p-2">Ano</th><th className="p-2">Saldo</th><th className="p-2" /></tr></thead>
          <tbody>{projects.map((p) => <tr key={p.id} className="border-t"><td className="p-2">{p.name}</td><td className="p-2 text-center">{p.year}</td><td className="p-2 text-right">{brl.format(Number(p.current_balance))}</td><td className="p-2 text-right"><Link to={`/admin/financeiro/projetos/${p.id}`} className="text-blue-600">Abrir</Link></td></tr>)}</tbody>
        </table>
      </div>
      <div>
        <h2 className="font-semibold">Pendências (top 5)</h2>
        <ul className="mt-2 space-y-2">{pending.map((item: any) => <li key={item.id} className="rounded border p-2 text-sm">{new Date(item.date).toLocaleDateString("pt-BR")} — {item.description} ({item.project?.name})</li>)}</ul>
      </div>
    </div>
  );
}
