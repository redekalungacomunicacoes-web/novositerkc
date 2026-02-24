import { Link } from 'react-router-dom';
import { Plus, Eye, Filter, Search } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../data/financeiro-data';
import { PROJETOS } from '../data/financeiro-data';

export function Projetos() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-gray-900">Projetos</h1>
          <button className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm">
            <Plus className="w-5 h-5" />
            Novo Projeto
          </button>
        </div>
        <p className="text-gray-600">Gerencie todos os projetos financeiros</p>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar projetos..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>
      </div>

      {/* Grid de Projetos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {PROJETOS.map((projeto) => (
          <div
            key={projeto.id}
            className="bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
          >
            {/* Header do Card */}
            <div className="bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20] p-6 text-white">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold">{projeto.nome}</h3>
                <StatusBadge status={projeto.status} />
              </div>
              <p className="text-sm text-white/80">{projeto.fundo}</p>
            </div>

            {/* Body do Card */}
            <div className="p-6">
              {/* Saldo */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-2">Saldo Disponível</p>
                <p className="text-3xl font-bold text-[#0f3d2e]">
                  {formatCurrency(projeto.saldo)}
                </p>
              </div>

              {/* Progresso */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Execução</span>
                  <span className="text-sm font-medium text-gray-900">
                    {projeto.percentualExecucao}%
                  </span>
                </div>
                <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0f3d2e] to-[#ffdd9a] rounded-full transition-all"
                    style={{ width: `${projeto.percentualExecucao}%` }}
                  />
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Orçado</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(projeto.totalOrcado)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Real</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(projeto.totalReal)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Diferença</p>
                  <p className="text-sm font-semibold text-red-600">
                    {formatCurrency(projeto.diferenca)}
                  </p>
                </div>
              </div>

              {/* Ação */}
              <Link
                to={`/admin/financeiro/projetos/${projeto.id}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors"
              >
                <Eye className="w-5 h-5" />
                Ver Detalhes
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
