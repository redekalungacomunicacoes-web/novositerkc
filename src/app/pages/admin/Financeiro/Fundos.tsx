import { Link } from 'react-router';
import { Plus, Eye, Edit, Trash2, Copy, TrendingUp } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency } from './data/financeiro-data';
import { FUNDOS } from './data/financeiro-data';

export function Fundos() {
  const totalFundos = FUNDOS.reduce((acc, f) => acc + f.totalOrcado, 0);
  const saldoDisponivel = FUNDOS.reduce((acc, f) => acc + f.saldoAtual, 0);
  const fundosAtivos = FUNDOS.filter(f => f.status === 'ativo').length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Fundos</h1>
            <p className="text-sm text-gray-600">Visão geral Financeiro</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600">Financeiro / Fundos</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Gerencie todos os fundos e recursos disponíveis</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" />
            Novo Fundo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm text-gray-600">Total em Fundos</p>
            <Copy className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalFundos)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm text-gray-600">Saldo Disponível</p>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(saldoDisponivel)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm text-gray-600">Fundos Ativos</p>
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600">i</span>
            </div>
          </div>
          <p className="text-2xl font-semibold text-gray-900">{fundosAtivos}</p>
        </div>
      </div>

      {/* Lista de Fundos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {FUNDOS.map((fundo) => (
          <div
            key={fundo.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Header do Card */}
            <div className="bg-[#0f3d2e] p-6 text-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold">{fundo.nome}</h3>
                  <p className="text-sm text-white/80">Ano {fundo.ano}</p>
                </div>
                <StatusBadge status={fundo.status} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-white/60 mb-1">Saldo Inicial</p>
                  <p className="text-xl font-bold">{formatCurrency(fundo.saldoInicial)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Total Gasto</p>
                  <p className="text-xl font-bold">{formatCurrency(fundo.totalGasto)}</p>
                </div>
              </div>
            </div>

            {/* Body do Card */}
            <div className="p-6">
              {/* Execução */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Execução</span>
                  <span className="text-sm font-medium text-gray-900">{fundo.execucao}%</span>
                </div>
                <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-[#0f3d2e] rounded-full transition-all"
                    style={{ width: `${fundo.execucao}%` }}
                  />
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Saldo Atual</p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatCurrency(fundo.saldoAtual)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Restante</p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatCurrency(fundo.totalOrcado - fundo.totalGasto)}
                  </p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <Link
                  to={`/admin/financeiro/fundo/${fundo.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalhes
                </Link>
              </div>
              <div className="flex gap-3 mt-3">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
