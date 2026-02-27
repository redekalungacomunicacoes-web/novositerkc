import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, Eye, Edit, Trash2, X } from 'lucide-react';
import { StatusBadge } from './components/StatusBadge';
import { formatCurrency, type FinanceiroProjeto } from './data/financeiro.repo';
import { useFinanceSupabase, type ProjectPayload } from './hooks/useFinanceSupabase';

type ProjectKind = 'proprio' | 'misto';

const currentYear = new Date().getFullYear();

const EMPTY_PROJECT: ProjectPayload = {
  name: '',
  year: currentYear,
  description: '',
  // fund_id vazio => projeto misto
  fund_id: '',
  initial_amount: 0,
  status: 'em_andamento',
};

export function Projetos() {
  const { projects, funds, error, createProject, updateProject, deleteProject } = useFinanceSupabase();
  const [search, setSearch] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editingProject, setEditingProject] = useState<FinanceiroProjeto | null>(null);
  const [form, setForm] = useState<ProjectPayload>(EMPTY_PROJECT);

  // Tipo do projeto (UI)
  const [kind, setKind] = useState<ProjectKind>('proprio');

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.nome.toLowerCase().includes(search.toLowerCase())),
    [projects, search],
  );

  const openCreate = () => {
    setEditingProject(null);
    setKind('proprio');
    setForm({
      ...EMPTY_PROJECT,
      year: currentYear,
      // pra "proprio" a gente pode criar fundo, então deixamos vazio e o hook cria
      fund_id: '',
      initial_amount: 0,
    });
    setOpenModal(true);
  };

  const openEdit = (project: FinanceiroProjeto) => {
    setEditingProject(project);

    const isMisto = !project.fundoId || String(project.fundoId).trim().length === 0;
    setKind(isMisto ? 'misto' : 'proprio');

    setForm({
      name: project.nome,
      year: currentYear,
      description: '',
      fund_id: project.fundoId || '',
      initial_amount: Number(project.totalOrcado) || 0,
      status: project.status,
    });

    setOpenModal(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: ProjectPayload = {
      ...form,
      // regras do tipo
      fund_id: kind === 'misto' ? '' : (form.fund_id || ''), // vazio => hook cria fundo próprio
      initial_amount: kind === 'misto' ? 0 : Number(form.initial_amount || 0),
    };

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
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-semibold text-gray-900">Projetos</h1>
            <p className="text-sm text-gray-600">Visão geral Financeiro</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">Financeiro / Projetos</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">Gerencie todos os projetos financeiros</p>
          </div>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#0f3d2e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a2b20]"
          >
            <Plus className="h-4 w-4" />
            Novo Projeto
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="Buscar projetos..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-transparent focus:ring-2 focus:ring-[#0f3d2e]"
            />
          </div>

          <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {(filteredProjects || []).map((projeto) => (
          <div
            key={projeto.id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
          >
            <div className="bg-[#0f3d2e] p-6 text-white">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="text-lg font-semibold">{projeto.nome}</h3>
                <StatusBadge status={projeto.status} />
              </div>

              <p className="text-xs text-white/80">
                Tipo:{' '}
                <b>{projeto.fundoId ? 'Fundo próprio / com fundo base' : 'Misto (sem fundo fixo)'}</b>
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <p className="mb-1 text-xs text-gray-500">Saldo Disponível</p>
                <p className="text-3xl font-bold text-[#0f3d2e]">
                  {formatCurrency(Number(projeto.saldoDisponivel) || 0)}
                </p>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Execução</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Number(projeto.execucao) || 0}%
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-[#0f3d2e] transition-all"
                    style={{ width: `${Number(projeto.execucao) || 0}%` }}
                  />
                </div>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-3">
                <div>
                  <p className="mb-1 text-xs text-gray-500">Orçado</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(projeto.totalOrcado) || 0)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Real</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(projeto.gastoReal) || 0)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">Diferença</p>
                  <p className="text-sm font-semibold text-red-600">
                    {formatCurrency(Number(projeto.diferenca) || 0)}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  to={`/admin/financeiro/projetos/${projeto.id}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f3d2e] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2b20]"
                >
                  <Eye className="h-4 w-4" />
                  Ver Detalhes
                </Link>
              </div>

              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => openEdit(projeto)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    void deleteProject(projeto.id).catch(() => undefined);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && <p className="mt-6 text-sm text-gray-500">Sem dados no período.</p>}

      {openModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
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

              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="mb-2 text-xs font-medium text-gray-700">Tipo do projeto</p>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={kind === 'proprio'}
                      onChange={() => setKind('proprio')}
                    />
                    Fundo próprio (cria um fundo do projeto e entra em “Fundos”)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={kind === 'misto'}
                      onChange={() => setKind('misto')}
                    />
                    Misto (sem fundo fixo; recebe verba via entradas vindas de fundos)
                  </label>
                </div>
              </div>

              {kind === 'proprio' && (
                <>
                  <p className="text-xs text-gray-600">
                    Se você **não selecionar um fundo**, o sistema cria automaticamente um **fundo próprio** para este projeto.
                  </p>

                  <select
                    value={form.fund_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, fund_id: e.target.value }))}
                    className="w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="">(Criar fundo próprio automaticamente)</option>
                    {funds.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        {fund.nome}
                      </option>
                    ))}
                  </select>

                  <input
                    required
                    type="number"
                    value={form.initial_amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, initial_amount: Number(e.target.value) }))}
                    placeholder="Valor inicial do projeto/fundo"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </>
              )}

              {kind === 'misto' && (
                <p className="text-xs text-gray-600">
                  Projeto misto inicia com **R$ 0**. Para colocar verba, registre uma **movimentação de ENTRADA** escolhendo o **fundo de origem**.
                </p>
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
                <button type="button" onClick={() => setOpenModal(false)} className="rounded border px-4 py-2 text-sm">
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
