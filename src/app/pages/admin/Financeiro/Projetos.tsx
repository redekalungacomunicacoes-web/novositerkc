import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, SlidersHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, listProjects, type FinanceiroProjeto } from './data/financeiro.repo';

export function Projetos() {
  const [projetos, setProjetos] = useState<FinanceiroProjeto[]>([]);

  useEffect(() => {
    async function load() {
      setProjetos(await listProjects());
    }
    void load();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Projetos</h1>
            <p className="text-sm text-gray-600">Visão geral Financeiro</p>
            <div className="flex items-center gap-2 mt-2"><span className="text-sm text-gray-600">Financeiro / Projetos</span></div>
            <p className="text-sm text-gray-600 mt-2">Gerencie todos os projetos financeiros</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium"><Plus className="w-4 h-4" />Novo Projeto</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar projetos..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent text-sm" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"><SlidersHorizontal className="w-4 h-4" />Filtros</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {(projetos || []).map((projeto) => (
          <div key={projeto.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-[#0f3d2e] p-6 text-white"><div className="flex items-start justify-between mb-2"><h3 className="text-lg font-semibold">{projeto.nome}</h3><StatusBadge status={projeto.status} /></div></div>
            <div className="p-6">
              <div className="mb-6"><p className="text-xs text-gray-500 mb-1">Saldo Disponível</p><p className="text-3xl font-bold text-[#0f3d2e]">{formatCurrency(Number(projeto.saldoDisponivel) || 0)}</p></div>
              <div className="mb-6"><div className="flex items-center justify-between mb-2"><span className="text-sm text-gray-600">Execução</span><span className="text-sm font-medium text-gray-900">{Number(projeto.execucao) || 0}%</span></div><div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="absolute top-0 left-0 h-full bg-[#0f3d2e] rounded-full transition-all" style={{ width: `${Number(projeto.execucao) || 0}%` }} /></div></div>
              <div className="grid grid-cols-3 gap-3 mb-6"><div><p className="text-xs text-gray-500 mb-1">Orçado</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(projeto.totalOrcado) || 0)}</p></div><div><p className="text-xs text-gray-500 mb-1">Real</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(projeto.gastoReal) || 0)}</p></div><div><p className="text-xs text-gray-500 mb-1">Diferença</p><p className="text-sm font-semibold text-red-600">{formatCurrency(Number(projeto.diferenca) || 0)}</p></div></div>
              <div className="flex gap-3"><Link to={`/admin/financeiro/projeto/${projeto.id}`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium"><Eye className="w-4 h-4" />Ver Detalhes</Link></div>
              <div className="flex gap-3 mt-3"><button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"><Edit className="w-4 h-4" />Editar</button><button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"><Trash2 className="w-4 h-4" />Excluir</button></div>
            </div>
          </div>
        ))}
      </div>
      {projetos.length === 0 && <p className="text-sm text-gray-500 mt-6">Sem dados no período.</p>}
    </div>
  );
}
