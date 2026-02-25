import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDashboardData, type DashboardData, type FinanceStatus, type FinanceiroFundo, type FinanceiroMovimentacao, type FinanceiroProjeto } from '../data/financeiro.repo';

type AnyRow = Record<string, any>;

export type FundPayload = {
  name: string;
  year: number;
  description: string;
  opening_balance: number;
  status: FinanceStatus;
};

export type ProjectPayload = {
  name: string;
  year: number;
  description: string;
  fund_id: string;
  initial_amount: number;
  status: FinanceStatus;
};

export type MovementPayload = {
  date: string;
  type: 'entrada' | 'saida';
  project_id: string;
  fund_id: string;
  title: string;
  description: string;
  unit_value: number;
  quantity: number;
  total_value: number;
  status: FinanceStatus;
  category: string;
  payment_method: string;
  payee: string;
  notes: string;
};

const toNumber = (value: unknown) => Number(value) || 0;

const normalizeStatus = (value: unknown, fallback: FinanceStatus): FinanceStatus => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'pago' || status === 'pendente' || status === 'cancelado' || status === 'ativo' || status === 'em_andamento' || status === 'concluido') {
    return status;
  }
  if (status === 'active') return 'ativo';
  if (status === 'done') return 'concluido';
  if (status === 'in_progress') return 'em_andamento';
  if (status === 'paid') return 'pago';
  if (status === 'canceled') return 'cancelado';
  return fallback;
};

const normalizeMovementPayload = (payload: Omit<MovementPayload, 'total_value' | 'status'> & { status: string }): MovementPayload => {
  const unitValue = toNumber(payload.unit_value);
  const quantity = toNumber(payload.quantity);
  return {
    ...payload,
    unit_value: unitValue,
    quantity,
    total_value: unitValue * quantity,
    status: normalizeStatus(payload.status, 'pendente'),
  };
};

const mapFund = (row: AnyRow): FinanceiroFundo => {
  const totalOrcado = toNumber(row.total_orcado ?? row.totalOrcado ?? row.orcado ?? row.opening_balance);
  const saldoInicial = toNumber(row.saldo_inicial ?? row.saldoInicial ?? row.opening_balance);
  const saldoAtual = toNumber(row.saldo_atual ?? row.saldoAtual ?? row.current_balance ?? row.balance ?? saldoInicial);
  const totalEntradas = toNumber(row.total_entradas ?? row.totalEntradas);
  const totalSaidas = toNumber(row.total_saidas ?? row.totalSaidas);
  const totalGasto = toNumber(row.total_gasto ?? row.totalGasto ?? totalSaidas);
  const execucao = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0;

  return {
    id: String(row.id),
    nome: String(row.nome ?? row.name ?? 'Sem nome'),
    ano: Number(row.ano ?? row.year ?? new Date().getFullYear()),
    totalOrcado,
    saldoInicial,
    saldoAtual,
    totalGasto,
    totalEntradas,
    totalSaidas,
    status: normalizeStatus(row.status, 'ativo'),
    execucao: Math.max(0, Math.min(100, Number(row.execucao ?? execucao))),
  };
};

const mapProject = (row: AnyRow, fundsById: Map<string, string>): FinanceiroProjeto => {
  const totalOrcado = toNumber(row.initial_amount ?? row.total_orcado ?? row.orcado);
  const saldoDisponivel = toNumber(row.current_balance ?? row.saldo_disponivel ?? row.saldoDisponivel);
  const gastoReal = Math.max(0, totalOrcado - saldoDisponivel);
  const fundoId = String(row.fund_id ?? row.fundo_id ?? '');

  return {
    id: String(row.id),
    nome: String(row.name ?? row.nome ?? 'Sem nome'),
    fundo: fundsById.get(fundoId) ?? String(row.funder ?? row.fundo ?? '—'),
    fundoId,
    saldoDisponivel,
    totalOrcado,
    gastoReal,
    diferenca: toNumber(row.diferenca ?? gastoReal - totalOrcado),
    execucao: totalOrcado > 0 ? Math.max(0, Math.min(100, (gastoReal / totalOrcado) * 100)) : 0,
    status: normalizeStatus(row.status, 'em_andamento'),
  };
};

const mapMovement = (row: AnyRow): FinanceiroMovimentacao => ({
  id: String(row.id),
  data: String(row.date ?? row.data ?? row.created_at ?? new Date().toISOString()),
  descricao: String(row.title ?? row.description ?? row.descricao ?? 'Sem descrição'),
  valorTotal: toNumber(row.total_value ?? row.valor_total),
  status: normalizeStatus(row.status, 'pendente'),
  projetoNome: String(row.project?.name ?? row.projeto_nome ?? '—'),
  projetoId: String(row.project_id ?? row.projeto_id ?? ''),
  fundo: String(row.fund?.name ?? row.project?.funder ?? row.fundo_nome ?? '—'),
  fundoId: String(row.fund_id ?? row.fundo_id ?? ''),
  categoria: String(row.category?.name ?? row.category ?? row.categoria ?? 'Sem categoria'),
  comprovantes: Array.isArray(row.comprovantes) ? row.comprovantes : [],
});

export function useFinanceSupabase() {
  const [funds, setFunds] = useState<FinanceiroFundo[]>([]);
  const [projects, setProjects] = useState<FinanceiroProjeto[]>([]);
  const [movements, setMovements] = useState<FinanceiroMovimentacao[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({
    entradas: 0,
    saidas: 0,
    saldoAtual: 0,
    pendencias: 0,
    fluxoCaixa: [],
    distribuicaoCategoria: [],
    orcadoVsReal: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [fundsRes, projectsRes, movementsRes, dashboardData] = await Promise.all([
      supabase.from('finance_funds').select('*').order('year', { ascending: false }),
      supabase.from('finance_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('finance_movements').select('*, project:finance_projects(id,name,funder), category:finance_categories(name), fund:finance_funds(id,name)').order('date', { ascending: false }),
      getDashboardData(),
    ]);

    if (fundsRes.error || projectsRes.error || movementsRes.error) {
      const firstError = fundsRes.error || projectsRes.error || movementsRes.error;
      setError(firstError?.message ?? 'Falha ao carregar dados financeiros.');
      setLoading(false);
      return;
    }

    const fundsMapped = (fundsRes.data || []).map(mapFund);
    const fundNameMap = new Map(fundsMapped.map((f) => [f.id, f.nome]));

    setFunds(fundsMapped);
    setProjects((projectsRes.data || []).map((row) => mapProject(row, fundNameMap)));
    setMovements((movementsRes.data || []).map(mapMovement));
    setDashboard(dashboardData);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runWithReload = useCallback(async (runner: () => Promise<{ error: { message: string } | null }>) => {
    setError(null);
    const result = await runner();
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    await load();
    return true;
  }, [load]);

  const createFund = useCallback(async (payload: FundPayload) => runWithReload(async () => {
    const normalized = {
      ...payload,
      status: normalizeStatus(payload.status, 'ativo'),
      opening_balance: toNumber(payload.opening_balance),
    };

    const { error } = await supabase.from('finance_funds').insert(normalized);
    return { error };
  }), [runWithReload]);

  const updateFund = useCallback(async (id: string, payload: FundPayload) => runWithReload(async () => {
    const normalized = {
      ...payload,
      status: normalizeStatus(payload.status, 'ativo'),
      opening_balance: toNumber(payload.opening_balance),
    };

    const { error } = await supabase.from('finance_funds').update(normalized).eq('id', id);
    return { error };
  }), [runWithReload]);

  const deleteFund = useCallback(async (id: string) => runWithReload(async () => {
    const { error } = await supabase.from('finance_funds').delete().eq('id', id);
    return { error };
  }), [runWithReload]);

  const createProject = useCallback(async (payload: ProjectPayload) => runWithReload(async () => {
    const normalized = {
      ...payload,
      status: normalizeStatus(payload.status, 'em_andamento'),
      initial_amount: toNumber(payload.initial_amount),
      current_balance: toNumber(payload.initial_amount),
    };

    const { error } = await supabase.from('finance_projects').insert(normalized);
    return { error };
  }), [runWithReload]);

  const updateProject = useCallback(async (id: string, payload: ProjectPayload) => runWithReload(async () => {
    const normalized = {
      ...payload,
      status: normalizeStatus(payload.status, 'em_andamento'),
      initial_amount: toNumber(payload.initial_amount),
    };

    const { error } = await supabase.from('finance_projects').update(normalized).eq('id', id);
    return { error };
  }), [runWithReload]);

  const deleteProject = useCallback(async (id: string) => runWithReload(async () => {
    const { error } = await supabase.from('finance_projects').delete().eq('id', id);
    return { error };
  }), [runWithReload]);

  const createMovement = useCallback(async (payload: Omit<MovementPayload, 'total_value' | 'status'> & { status: string }) => runWithReload(async () => {
    const normalized = normalizeMovementPayload(payload);
    const { error } = await supabase.from('finance_movements').insert({
      date: normalized.date,
      type: normalized.type,
      project_id: normalized.project_id,
      fund_id: normalized.fund_id,
      title: normalized.title,
      description: normalized.description || normalized.title,
      unit_value: normalized.unit_value,
      quantity: normalized.quantity,
      total_value: normalized.total_value,
      status: normalized.status,
      category: normalized.category,
      payment_method: normalized.payment_method,
      payee: normalized.payee,
      notes: normalized.notes,
    });
    return { error };
  }), [runWithReload]);

  const updateMovement = useCallback(async (id: string, payload: Omit<MovementPayload, 'total_value' | 'status'> & { status: string }) => runWithReload(async () => {
    const normalized = normalizeMovementPayload(payload);
    const { error } = await supabase.from('finance_movements').update({
      date: normalized.date,
      type: normalized.type,
      project_id: normalized.project_id,
      fund_id: normalized.fund_id,
      title: normalized.title,
      description: normalized.description || normalized.title,
      unit_value: normalized.unit_value,
      quantity: normalized.quantity,
      total_value: normalized.total_value,
      status: normalized.status,
      category: normalized.category,
      payment_method: normalized.payment_method,
      payee: normalized.payee,
      notes: normalized.notes,
    }).eq('id', id);
    return { error };
  }), [runWithReload]);

  const deleteMovement = useCallback(async (id: string) => runWithReload(async () => {
    const { error } = await supabase.from('finance_movements').delete().eq('id', id);
    return { error };
  }), [runWithReload]);

  return {
    funds,
    projects,
    movements,
    dashboard,
    loading,
    error,
    load,
    createFund,
    updateFund,
    deleteFund,
    createProject,
    updateProject,
    deleteProject,
    createMovement,
    updateMovement,
    deleteMovement,
  };
}
