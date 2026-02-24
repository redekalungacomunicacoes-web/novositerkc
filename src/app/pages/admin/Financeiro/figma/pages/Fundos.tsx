import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, AlertCircle, Plus, Eye } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../data/financeiro-data';
import { FUNDOS } from '../data/financeiro-data';

export function Fundos() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold text-gray-900">Fundos</h1>
          <button className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm">
            <Plus className="w-5 h-5" />
            Novo Fundo
          </button>
        </div>
        <p className="text-gray-600">Gerencie todos os fundos e recursos disponíveis</p>
      </div>

      {/* KPIs Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="Total em Fundos"
          value={formatCurrency(175000)}
          icon={Wallet}
          variant="success"
        />
        <KPICard
          title="Saldo Disponível"
          value={formatCurrency(111630)}
          icon={TrendingUp}
        />
        <KPICard
          title="Fundos Ativos"
          value="2"
          icon={AlertCircle}
          variant="default"
        />
      </div>

      {/* Lista de Fundos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {FUNDOS.map((fundo) => (
          <div
            key={fundo.id}
            className="bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
          >
            {/* Header do Card */}
            <div className="bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20] p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold mb-1">{fundo.nome}</h3>
                  <p className="text-sm text-white/80">Ano {fundo.ano}</p>
                </div>
                <StatusBadge status={fundo.status} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/60 mb-1">Saldo Atual</p>
                  <p className="text-2xl font-bold">{formatCurrency(fundo.saldoAtual)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Total Orçado</p>
                  <p className="text-2xl font-bold">{formatCurrency(fundo.totalOrcado)}</p>
                </div>
              </div>
            </div>

            {/* Body do Card */}
            <div className="p-6">
              {/* Progresso */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Execução</span>
                  <span className="text-sm font-medium text-gray-900">
                    {((fundo.totalGastoReal / fundo.totalOrcado) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0f3d2e] to-[#ffdd9a] rounded-full transition-all"
                    style={{ width: `${(fundo.totalGastoReal / fundo.totalOrcado) * 100}%` }}
                  />
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Gasto Real</p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatCurrency(fundo.totalGastoReal)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Restante</p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatCurrency(fundo.totalOrcado - fundo.totalGastoReal)}
                  </p>
                </div>
              </div>

              {/* Ações */}
              <Link
                to={`/admin/financeiro/fundos/${fundo.id}`}
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
