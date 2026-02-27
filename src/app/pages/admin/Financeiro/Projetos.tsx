import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Plus, Search, SlidersHorizontal, Eye, Edit, Trash2, X } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, type FinanceiroProjeto } from './data/financeiro.repo';
import { useFinanceSupabase, type ProjectPayload } from './hooks/useFinanceSupabase';

type FundingMode = 'proprio' | 'misto';

const EMPTY_PROJECT: ProjectPayload = {
  name: '',
  year: new Date().getFullYear(),
  description: '',
  fund_id: '',
  initial_amount: 0,
  status: 'em_andamento',
};

function inferFundingModeFromProject(project: FinanceiroProjeto): FundingMode {
  // Heurística simples pra edição:
  // se tiver orçamento/valor inicial > 0, assume "proprio"; senão "misto"
  const total = Number(project.totalOrcado) || 0;
  return total > 0 ? 'proprio' : 'misto';
}

export function Projetos() {
  const { projects, funds, error, createProject, updateProject, deleteProject } = useFinanceSupabase();

  const [search, setSearch] = useState('');
  const [openModal, setOpenModal] = useState(false);

  const [editingProject, setEditingProject] = useState<FinanceiroProjeto | null>(null);
  const [form, setForm] = useState<ProjectPayload>(EMPTY_PROJECT);

  // Novo: modo de financiamento do projeto
  const [fundingMode, setFundingMode] = useState<FundingMode>('misto');

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.nome.toLowerCase().includes(search.toLowerCase())),
    [projects, search],
  );

  const openCreate = () => {
    setEditingProject(null);
    setFundingMode('misto');
    // Para "misto", não definimos valor nem fundo fixo na criação
    setForm({ ...EMPTY_PROJECT, fund_id: '', initial_amount: 0 });
    setOpenModal(true);
  };

  const openEdit = (project: FinanceiroProjeto) => {
    setEditingProject(project);

    const mode = inferFundingModeFromProject(project);
    setFundingMode(mode);

    setForm({
      name: project.nome,
      year: new Date().getFullYear(),
      description: '',
      // Se for misto, não travamos fundo (fica vazio). Se for próprio, mantém o fundoId que já existe.
      fund_id: mode === 'misto' ? '' : project.fundoId,
      // Se for misto, não existe valor inicial fixo (0). Se for próprio, usa o totalOrcado como proxy do inicial.
      initial_amount: mode === 'misto' ? 0 : Number(project.totalOrcado) || 0,
      status: project.status,
    });

    setOpenModal(true);
  };

  const buildPayloadForSave = (raw: ProjectPayload, mode: FundingMode): ProjectPayload => {
    // Regra do seu fluxo:
    // - Projeto próprio: tem valor inicial definido. Fundo fixo na criação não é obrigatório (pode ser resolvido no backend)
    // - Projeto misto: NÃO define valor inicial, recebe recursos via movimentações (com fundo de origem)
    if (mode === 'misto') {
      return {
        ...raw,
        fund_id: '', // deixa aberto (sem fundo fixo)
        initial_amount: 0,
      };
    }

    // modo próprio
    return {
      ...raw,
      // fundo fixo não é obrigatório; se você quiser forçar, basta tornar required no select quando "proprio"
      // aqui mantemos como está no form (pode estar vazio e seu backend/hook decide como criar o fundo do projeto)
      initial_amount: Number(raw.initial_amount) || 0,
    };
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = buildPayloadForSave(form, fundingMode);

    try {
      await (editingProject ? updateProject(editingProject.id, payload) : createProject(payload));
      setOpenModal(false);
      setEditingProject(null);
    } catch {
      // erro já exibido via hook
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Projetos</h1>
            <p className="text-sm text-gray-600">Visão geral Financeiro</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-600">Financeiro / Projetos</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Gerencie todos os projetos financeiros</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="Buscar projetos..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent text-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {(filteredProjects || []).map((projeto) => (
          <div
            key={projeto.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="bg-[#0f3d2e] p-6 text-white">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold">{projeto.nome}</h3>
                <StatusBadge status={projeto.status} />
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-1">Saldo Disponível</p>
                <p className="text-3xl font-bold text-[#0f3d2e]">
                  {formatCurrency(Number(projeto.saldoDisponivel) || 0)}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Execução</span>
                  <span className="text-sm font-medium text-gray-900">{Number(projeto.execucao) || 0}%</span>
                </div>
                <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-[#0f3d2e] rounded-full transition-all"
                    style={{ width: `${Number(projeto.execucao) || 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Orçado</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(projeto.totalOrcado) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Real</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(projeto.gastoReal) || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Diferença</p>
                  <p className="text-sm font-semibold text-red-600">
                    {formatCurrency(Number(projeto.diferenca) || 0)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  to={`/admin/financeiro/projetos/${projeto.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalhes
                </Link>
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => openEdit(projeto)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>

                <button
                  onClick={() => {
                    void deleteProject(projeto.id).catch(() => undefined);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && <p className="text-sm text-gray-500 mt-6">Sem dados no período.</p>}

      {openModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingProject ? 'Editar projeto' : 'Novo projeto'}</h2>
              <button onClick={() => setOpenModal(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSave}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome"
                className="w-full rounded border px-3 py-2 text-sm"
              />

              <input
                required
                type="number"
                value={form.year}
                onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
                placeholder="Ano"
                className="w-full rounded border px-3 py-2 text-sm"
              />

              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição"
                className="w-full rounded border px-3 py-2 text-sm"
              />

              {/* NOVO: tipo de financiamento */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Tipo do projeto</label>
                <select
                  value={fundingMode}
                  onChange={(e) => {
                    const mode = e.target.value as FundingMode;
                    setFundingMode(mode);

                    // Ajusta campos conforme regra
                    if (mode === 'misto') {
                      setForm((prev) => ({ ...prev, fund_id: '', initial_amount: 0 }));
                    } else {
                      // próprio: mantém initial_amount (se já tiver) e libera fund_id opcional
                      setForm((prev) => ({ ...prev, initial_amount: Number(prev.initial_amount) || 0 }));
                    }
                  }}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="misto">Misto (recebe verba via movimentações)</option>
                  <option value="proprio">Fundo próprio (define valor inicial)</option>
                </select>

                {fundingMode === 'misto' ? (
                  <p className="text-xs text-gray-500">
                    No modo <b>misto</b>, este projeto começa sem valor fixo e vai receber recursos somente quando você lançar
                    movimentações escolhendo o <b>fundo de origem</b>.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    No modo <b>fundo próprio</b>, você define um valor inicial. Esse projeto será tratado como um fundo do próprio
                    projeto (e entrará nos totais do dashboard quando ajustarmos o hook/dashboard).
                  </p>
                )}
              </div>

              {/* Fundo só faz sentido quando não é "misto" OU se você quiser manter um fundo base.
                  No seu fluxo, o misto deixa em branco e decide nas movimentações. */}
              {fundingMode === 'proprio' && (
                <select
                  value={form.fund_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, fund_id: e.target.value }))}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">(Opcional) Vincular a um fundo existente</option>
                  {funds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.nome}
                    </option>
                  ))}
                </select>
              )}

              {/* Valor inicial só no modo próprio */}
              {fundingMode === 'proprio' && (
                <input
                  required
                  type="number"
                  value={form.initial_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, initial_amount: Number(e.target.value) }))}
                  placeholder="Valor inicial"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              )}

              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ProjectPayload['status'] }))}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button type="submit" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
