import { useEffect, useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, Plus } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { KPICard } from '../components/KPICard';
import { ModalMovimentacao } from '../components/ModalMovimentacao';
import { formatCurrency } from '../data/financeiro-data';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { SupabaseHealth } from '../../components/SupabaseHealth';

export function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [funds, setFunds] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const { listFunds, listProjects, listMovementsByFund, createMovement } = useFinanceSupabase();

  useEffect(() => {
    const load = async () => {
      try {
        const fundsData = await listFunds();
        const projectData = await listProjects();
        setFunds(fundsData || []);
        setProjects(projectData || []);
        const movs = await Promise.all((fundsData || []).map((f: any) => listMovementsByFund(f.id)));
        setMovements(movs.flat());
      } catch (error) {
        if (import.meta.env.DEV) console.error(error);
      }
    };
    void load();
  }, []);

  const saldoTotal = useMemo(() => funds.reduce((acc, f) => acc + Number(f.current_balance || 0), 0), [funds]);
  const entradasMes = useMemo(() => movements.filter((m) => m.type === 'entrada').reduce((a, m) => a + Number(m.total_value || 0), 0), [movements]);
  const saidasMes = useMemo(() => movements.filter((m) => m.type === 'saida').reduce((a, m) => a + Number(m.total_value || 0), 0), [movements]);
  const pendencias = useMemo(() => movements.filter((m) => m.status === 'pendente'), [movements]);

  const fluxoCaixaData = useMemo(() => {
    const grouped = new Map<string, { mes: string; entradas: number; saidas: number }>();
    movements.forEach((m) => {
      const mes = new Date(m.date).toLocaleDateString('pt-BR', { month: 'short' });
      const row = grouped.get(mes) || { mes, entradas: 0, saidas: 0 };
      if (m.type === 'entrada') row.entradas += Number(m.total_value || 0);
      else row.saidas += Number(m.total_value || 0);
      grouped.set(mes, row);
    });
    return Array.from(grouped.values()).slice(-6);
  }, [movements]);

  const categoriasMes = useMemo(() => {
    const byCategory = new Map<string, number>();
    movements.forEach((m) => {
      const cat = m.category || 'OUTROS';
      byCategory.set(cat, (byCategory.get(cat) || 0) + Number(m.total_value || 0));
    });
    const colors = ['#0f3d2e', '#ffdd9a', '#6b7280', '#93c5fd', '#d1d5db'];
    return Array.from(byCategory.entries()).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [movements]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard Financeiro</h1>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm"><Plus className="w-5 h-5" />Nova Movimentação</button>
        </div>
        <div className="flex items-center gap-3"><p className="text-gray-600">Visão geral das finanças e projetos</p><Link to="/admin/financeiro/fundos" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver Fundos</Link><Link to="/admin/financeiro/projetos" className="text-sm text-[#0f3d2e] hover:underline font-medium">Ver Projetos</Link></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard title="Saldo Total Atual" value={formatCurrency(saldoTotal)} icon={Wallet} variant="success" />
        <KPICard title="Entradas" value={formatCurrency(entradasMes)} icon={TrendingUp} />
        <KPICard title="Saídas" value={formatCurrency(saidasMes)} icon={TrendingDown} />
        <KPICard title="Pendências" value={String(pendencias.length)} icon={AlertCircle} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Fluxo de Caixa (6 meses)</h3><ResponsiveContainer width="100%" height={300}><LineChart data={fluxoCaixaData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Line type="monotone" dataKey="entradas" stroke="#0f3d2e" strokeWidth={2} name="Entradas" /><Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" /></LineChart></ResponsiveContainer></div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Orçado vs Real (por mês)</h3><ResponsiveContainer width="100%" height={300}><BarChart data={fluxoCaixaData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Bar dataKey="entradas" fill="#ffdd9a" name="Orçado" /><Bar dataKey="saidas" fill="#0f3d2e" name="Real" /></BarChart></ResponsiveContainer></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8"><h3 className="text-lg font-semibold text-gray-900 mb-6">Distribuição por Categoria</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={categoriasMes} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">{categoriasMes.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></div>

      <ModalMovimentacao
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        funds={funds.map((f) => ({ id: f.id, name: f.name }))}
        onSubmit={async (payload) => {
          try {
            await createMovement(payload);
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
          }
        }}
      />
    </div>
  );
}
