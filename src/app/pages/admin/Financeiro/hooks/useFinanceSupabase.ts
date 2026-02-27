// (COLE AQUI O MESMO CÓDIGO QUE VOCÊ MANDOU, COM APENAS AS MUDANÇAS ABAIXO)
// ✅ 1) ProjectPayload: fund_id agora pode ser '' (misto) OU vazio (pra criar fundo)
// ✅ 2) createProject: se payload.fund_id vier '' E initial_amount > 0 => cria fundo próprio e usa esse id
// ✅ 3) updateProject: se projeto era misto e passou a próprio, também pode criar fundo (opcional)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  DashboardData,
  FinanceAttachment,
  FinanceStatus,
  FinanceiroFundo,
  FinanceiroMovimentacao,
  FinanceiroProjeto,
} from '../data/financeiro.repo';
import { formatCurrency } from '../data/financeiro.repo';
import { computeFundBalances } from '../utils/balances';

type AnyRow = Record<string, unknown>;

type MovementStatus = 'pago' | 'pendente' | 'cancelado';
type MovementType = 'entrada' | 'saida';
type PayMethod = 'pix' | 'transferencia' | 'dinheiro';

export type FundPayload = {
  name: string;
  year: number;
  description: string;
  opening_balance: number;
  status: Extract<FinanceStatus, 'ativo' | 'concluido' | 'cancelado'>;
};

export type ProjectPayload = {
  name: string;
  year: number;
  description: string;
  // ✅ pode ser '' (misto) ou id (com fundo base) ou '' + initial_amount>0 (cria fundo próprio)
  fund_id?: string;
  initial_amount: number;
  status: Extract<FinanceStatus, 'em_andamento' | 'concluido' | 'cancelado'>;
};

export type MovementPayload = {
  date: string;
  type: MovementType;
  project_id?: string;
  fund_id?: string;
  category_id?: string;
  title?: string;
  description: string;
  unit_value: number;
  quantity: number;
  total_value?: number;
  status: MovementStatus;
  pay_method: PayMethod;
  beneficiary?: string;
  notes?: string;
  doc_type?: string;
  doc_number?: string;
  cost_center?: string;
};

export type FinanceCategory = {
  id: string;
  name: string;
  color?: string;
};

export type MovementFilters = {
  fundId?: string;
  projectId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  status?: MovementStatus;
  limit?: number;
};

export type ReportMode = 'geral' | 'fundo' | 'projeto';

export type ReportFilters = {
  mode: ReportMode;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  fundId?: string;
  projectId?: string;
  status?: MovementStatus;
};

type ReportSummary = {
  entradas: number;
  saidas: number;
  saldo: number;
  pendencias: number;
};

const toNumber = (value: unknown) => Number(value) || 0;

const ensure = (error: { message?: string } | null, fallbackMessage: string) => {
  if (error) throw new Error(error.message || fallbackMessage);
};

const normalizeStatus = (value: unknown, fallback: FinanceStatus): FinanceStatus => {
  const status = `${value ?? ''}`.toLowerCase();
  if (['pago', 'pendente', 'cancelado', 'ativo', 'em_andamento', 'concluido'].includes(status)) return status as FinanceStatus;
  if (status === 'active') return 'ativo';
  if (status === 'done') return 'concluido';
  if (status === 'in_progress') return 'em_andamento';
  if (status === 'paid') return 'pago';
  return fallback;
};

const normalizeMovementStatus = (value: unknown): MovementStatus => {
  const status = `${value ?? ''}`.toLowerCase();
  if (status === 'pago' || status === 'pendente' || status === 'cancelado') return status;
  return 'pendente';
};

const normalizeType = (value: unknown): MovementType =>
  (`${value ?? ''}`.toLowerCase() === 'entrada' ? 'entrada' : 'saida');

const normalizePayMethod = (value: unknown): PayMethod => {
  const method = `${value ?? ''}`.toLowerCase();
  if (method === 'pix' || method === 'transferencia' || method === 'dinheiro') return method;
  if (method === 'transferência') return 'transferencia';
  return 'pix';
};

const mapAttachment = (row: AnyRow): FinanceAttachment => ({
  id: String(row.id ?? ''),
  movement_id: String(row.movement_id ?? ''),
  file_name: String(row.file_name ?? 'arquivo'),
  mime_type: String(row.mime_type ?? 'application/octet-stream'),
  file_size: toNumber(row.file_size),
  storage_path: String(row.storage_path ?? ''),
  public_url: row.public_url ? String(row.public_url) : undefined,
  created_at: String(row.created_at ?? new Date().toISOString()),
});

const mapFund = (row: AnyRow): FinanceiroFundo => {
  const totalOrcado = toNumber(row.total_orcado ?? row.opening_balance);
  const saldoInicial = toNumber(row.saldo_inicial ?? row.opening_balance);
  const totalEntradas = toNumber(row.total_entradas);
  const totalSaidas = toNumber(row.total_saidas);
  const totalGasto = toNumber(row.total_gasto ?? totalSaidas);

  const saldoAtualInformado = row.saldo_atual ?? row.current_balance;
  const saldoAtualCalculado = saldoInicial + totalEntradas - totalSaidas;
  const saldoAtual = Number.isFinite(Number(saldoAtualInformado)) ? Number(saldoAtualInformado) : saldoAtualCalculado;

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
    execucao: totalOrcado > 0 ? Math.min(100, (totalGasto / totalOrcado) * 100) : 0,
  };
};

const mapProject = (row: AnyRow, fundsById: Map<string, string>): FinanceiroProjeto => {
  const totalOrcado = toNumber(row.initial_amount ?? row.total_orcado);
  const saldoDisponivel = toNumber(row.current_balance ?? row.saldo_disponivel);
  const gastoReal = Math.max(0, totalOrcado - saldoDisponivel);

  const fundoId = String(row.fund_id ?? '');
  return {
    id: String(row.id),
    nome: String(row.name ?? row.nome ?? 'Sem nome'),
    fundo: fundoId ? (fundsById.get(fundoId) ?? String(row.funder ?? '—')) : '—',
    fundoId: fundoId || '',
    saldoDisponivel,
    totalOrcado,
    gastoReal,
    diferenca: gastoReal - totalOrcado,
    execucao: totalOrcado > 0 ? Math.min(100, (gastoReal / totalOrcado) * 100) : 0,
    status: normalizeStatus(row.status, 'em_andamento'),
  };
};

const mapMovement = (row: AnyRow): FinanceiroMovimentacao => ({
  id: String(row.id),
  data: String(row.date ?? row.created_at ?? new Date().toISOString()),
  tipo: normalizeType(row.type),
  titulo: String(row.title ?? row.description ?? 'Sem título'),
  descricao: String(row.description ?? row.title ?? 'Sem descrição'),
  valorUnitario: toNumber(row.unit_value),
  quantidade: toNumber(row.quantity || 1),
  valorTotal: toNumber(row.total_value),
  status: normalizeMovementStatus(row.status),
  projetoNome: String((row.project as AnyRow | undefined)?.name ?? row.project_name ?? '—'),
  projetoId: String(row.project_id ?? ''),
  fundo: String((row.fund as AnyRow | undefined)?.name ?? row.fund_name ?? '—'),
  fundoId: String(row.fund_id ?? ''),
  categoria: String((row.category as AnyRow | undefined)?.name ?? row.category_name ?? 'Sem categoria'),
  categoriaId: row.category_id ? String(row.category_id) : '',
  payMethod: normalizePayMethod(row.pay_method),
  beneficiary: String(row.beneficiary ?? ''),
  notes: String(row.notes ?? ''),
  docType: String(row.doc_type ?? ''),
  docNumber: String(row.doc_number ?? ''),
  costCenter: String(row.cost_center ?? ''),
  attachmentsCount: toNumber(row.attachments_count),
  comprovantes: Array.isArray(row.attachments) ? row.attachments.map((item) => mapAttachment(item as AnyRow)) : [],
});

const movementSelect =
  'id,date,type,fund_id,project_id,title,description,unit_value,quantity,total_value,status,category_id,pay_method,beneficiary,notes,doc_type,doc_number,cost_center,created_at,project:finance_projects(id,name,fund_id),fund:finance_funds(id,name),category:finance_categories(id,name,color),attachments:finance_attachments(*)';

const buildMovementsQuery = (filters?: MovementFilters) => {
  let query = supabase.from('finance_movements').select(movementSelect);
  if (filters?.fundId) query = query.eq('fund_id', filters.fundId);
  if (filters?.projectId) query = query.eq('project_id', filters.projectId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.startDate) query = query.gte('date', filters.startDate);
  if (filters?.endDate) query = query.lte('date', filters.endDate);
  query = query.order('date', { ascending: false });
  if (filters?.limit) query = query.limit(filters.limit);
  return query;
};

const monthKey = (dateIsoLike: string) => {
  const d = new Date(dateIsoLike);
  if (Number.isNaN(d.getTime())) return String(dateIsoLike).slice(0, 7);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}`;
};

const buildPeriodsBetween = (startDate: string, endDate: string) => {
  const periods: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return periods;

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor.getTime() <= last.getTime()) {
    const mm = String(cursor.getMonth() + 1).padStart(2, '0');
    periods.push(`${cursor.getFullYear()}-${mm}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
};

const DEFAULT_DASHBOARD: DashboardData = {
  entradas: 0,
  saidas: 0,
  saldoAtual: 0,
  pendencias: 0,
  fluxoCaixa: [],
  distribuicaoCategoria: [],
  orcadoVsReal: [],
};

const openPrint = (html: string, title = 'Relatório Financeiro') => {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!w) {
    alert('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  setTimeout(() => {
    w.focus();
    w.print();
    setTimeout(() => w.close(), 500);
  }, 250);
};

const escapeHtml = (s: any) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c] as string),
  );

const buildReportHtml = (opts: {
  title: string;
  logoDataUrl?: string | null;
  filters: ReportFilters;
  summary: ReportSummary;
  list: FinanceiroMovimentacao[];
  fundName?: string;
  projectName?: string;
}) => {
  const { title, logoDataUrl, filters, summary, list, fundName, projectName } = opts;

  const modeLabel =
    filters.mode === 'geral' ? 'Geral' : filters.mode === 'fundo' ? `Fundo: ${fundName ?? '—'}` : `Projeto: ${projectName ?? '—'}`;

  const rows = list
    .map(
      (m) => `
    <tr>
      <td>${escapeHtml(String(m.data).slice(0, 10))}</td>
      <td>${escapeHtml(m.tipo)}</td>
      <td>${escapeHtml(m.fundo || '—')}</td>
      <td>${escapeHtml(m.projetoNome !== '—' ? m.projetoNome : '—')}</td>
      <td>${escapeHtml(m.categoria || '—')}</td>
      <td>${escapeHtml(m.descricao || '—')}</td>
      <td style="text-align:right;">${escapeHtml(formatCurrency(m.valorTotal))}</td>
      <td>${escapeHtml(m.status)}</td>
    </tr>
  `,
    )
    .join('');

  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; }
  .top { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:12px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .logo { width:52px; height:52px; border-radius:12px; object-fit:contain; background:#f3f3f3; }
  h1 { margin:0; font-size:16px; }
  .meta { font-size:12px; color:#444; margin-top:4px; }
  .cards { display:flex; gap:10px; margin: 12px 0 14px; }
  .card { flex:1; border:1px solid #e3e3e3; border-radius:12px; padding:10px; }
  .label { font-size:11px; color:#666; }
  .value { font-size:14px; font-weight:700; margin-top:6px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th, td { border-bottom:1px solid #eee; padding:7px 6px; vertical-align:top; }
  th { text-align:left; font-size:10px; color:#555; }
  .footer { margin-top:12px; font-size:10px; color:#666; }
</style>
</head>
<body>
  <div class="top">
    <div class="brand">
      ${logoDataUrl ? `<img class="logo" src="${escapeHtml(logoDataUrl)}" />` : `<div class="logo"></div>`}
      <div>
        <h1>RELATÓRIO FINANCEIRO</h1>
        <div class="meta">Período: ${escapeHtml(filters.startDate)} até ${escapeHtml(filters.endDate)}</div>
        <div class="meta">Filtro: ${escapeHtml(modeLabel)} • Status: ${escapeHtml(filters.status ?? 'todos')}</div>
      </div>
    </div>
    <div class="meta">Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
  </div>

  <div class="cards">
    <div class="card"><div class="label">Entradas pagas</div><div class="value">${escapeHtml(formatCurrency(summary.entradas))}</div></div>
    <div class="card"><div class="label">Saídas pagas</div><div class="value">${escapeHtml(formatCurrency(summary.saidas))}</div></div>
    <div class="card"><div class="label">Saldo (pagos)</div><div class="value">${escapeHtml(formatCurrency(summary.saldo))}</div></div>
    <div class="card"><div class="label">Pendências</div><div class="value">${escapeHtml(formatCurrency(summary.pendencias))}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:75px;">Data</th>
        <th style="width:55px;">Tipo</th>
        <th style="width:110px;">Fundo</th>
        <th style="width:110px;">Projeto</th>
        <th style="width:90px;">Categoria</th>
        <th>Descrição</th>
        <th style="width:85px;text-align:right;">Valor</th>
        <th style="width:75px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="8" style="padding:12px;color:#666;">Sem registros para este filtro/período.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">PDF gerado via impressão do navegador (sem bibliotecas externas).</div>
</body>
</html>`;
};

export function useFinanceSupabase() {
  const [funds, setFunds] = useState<FinanceiroFundo[]>([]);
  const [projects, setProjects] = useState<FinanceiroProjeto[]>([]);
  const [movements, setMovements] = useState<FinanceiroMovimentacao[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>(DEFAULT_DASHBOARD);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeDashboard = useMemo<DashboardData>(() => dashboard ?? DEFAULT_DASHBOARD, [dashboard]);

  const fundsById = useMemo(() => new Map(funds.map((f) => [f.id, f.nome])), [funds]);
  const projectToFundId = useMemo(() => new Map(projects.map((p) => [p.id, p.fundoId])), [projects]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p.nome])), [projects]);

  const normalizeMovementFund = useCallback(
    (m: FinanceiroMovimentacao): FinanceiroMovimentacao => {
      const resolvedFundId = m.fundoId || (m.projetoId ? projectToFundId.get(m.projetoId) ?? '' : '');
      const resolvedFundName = resolvedFundId ? (fundsById.get(resolvedFundId) ?? m.fundo) : m.fundo;

      const resolvedProjectName =
        m.projetoNome !== '—'
          ? m.projetoNome
          : m.projetoId
            ? (projectsById.get(m.projetoId) ?? m.projetoNome)
            : m.projetoNome;

      return {
        ...m,
        fundoId: resolvedFundId,
        fundo: resolvedFundName || '—',
        projetoNome: resolvedProjectName || '—',
      };
    },
    [fundsById, projectToFundId, projectsById],
  );

  const listFunds = useCallback(async () => {
    const { data, error: fundsError } = await supabase.from('finance_funds').select('*').order('year', { ascending: false });
    ensure(fundsError, 'Falha ao listar fundos.');
    return (data || []).map((row) => mapFund(row as AnyRow));
  }, []);

  const listProjects = useCallback(async (fundItems?: FinanceiroFundo[]) => {
    const { data, error: projectsError } = await supabase.from('finance_projects').select('*').order('created_at', { ascending: false });
    ensure(projectsError, 'Falha ao listar projetos.');
    const list = fundItems ?? [];
    const byId = new Map(list.map((f) => [f.id, f.nome]));
    return (data || []).map((row) => mapProject(row as AnyRow, byId));
  }, []);

  const listCategories = useCallback(async () => {
    const { data, error: categoriesError } = await supabase.from('finance_categories').select('id,name,color').order('name', { ascending: true });
    ensure(categoriesError, 'Falha ao listar categorias.');
    return (data || []).map((item: any) => ({ id: String(item.id), name: String(item.name), color: item.color ? String(item.color) : undefined }));
  }, []);

  const listAttachments = useCallback(async (movementId: string) => {
    const { data, error: attachmentsError } = await supabase.from('finance_attachments').select('*').eq('movement_id', movementId).order('created_at', { ascending: false });
    ensure(attachmentsError, 'Falha ao listar anexos.');
    return (data || []).map((row) => mapAttachment(row as AnyRow));
  }, []);

  const listMovements = useCallback(
    async (filters?: MovementFilters) => {
      const { data, error: movementsError } = await buildMovementsQuery(filters);
      ensure(movementsError, 'Falha ao listar movimentações.');
      const list = (data || []).map((row) => mapMovement(row as AnyRow));
      return list.map(normalizeMovementFund);
    },
    [normalizeMovementFund],
  );

  const listLatestMovements = useCallback(async () => listMovements({ limit: 10 }), [listMovements]);

  const getDashboardAggregates = useCallback(async (): Promise<DashboardData> => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 5);

      const start = startDate.toISOString().slice(0, 10);
      const end = endDate.toISOString().slice(0, 10);

      const [movementsRes, paidFundsMovementsRes, fundsList] = await Promise.all([
        buildMovementsQuery({ startDate: start, endDate: end }),
        buildMovementsQuery({ status: 'pago' }),
        listFunds(),
      ]);

      ensure(movementsRes.error, 'Falha ao carregar dados do dashboard.');
      ensure(paidFundsMovementsRes.error, 'Falha ao carregar saldo dos fundos.');

      const raw = (movementsRes.data || []).map((row) => mapMovement(row as AnyRow));
      const paidFundsRaw = (paidFundsMovementsRes.data || []).map((row) => mapMovement(row as AnyRow));

      const projectFundFromRow = new Map<string, string>();
      raw.forEach((_m, idx) => {
        const r = movementsRes.data?.[idx] as AnyRow | undefined;
        const proj = r?.project as AnyRow | undefined;
        if (proj?.id && proj?.fund_id) projectFundFromRow.set(String(proj.id), String(proj.fund_id));
      });

      const paidFundProjectMap = new Map<string, string>();
      paidFundsRaw.forEach((_m, idx) => {
        const r = paidFundsMovementsRes.data?.[idx] as AnyRow | undefined;
        const proj = r?.project as AnyRow | undefined;
        if (proj?.id && proj?.fund_id) paidFundProjectMap.set(String(proj.id), String(proj.fund_id));
      });

      const fundsNameById = new Map(fundsList.map((f) => [f.id, f.nome]));

      const normalized = raw.map((m) => {
        const resolvedFundId = m.fundoId || (m.projetoId ? (projectFundFromRow.get(m.projetoId) ?? '') : '');
        const resolvedFundName = resolvedFundId ? (fundsNameById.get(resolvedFundId) ?? m.fundo) : m.fundo;
        return { ...m, fundoId: resolvedFundId, fundo: resolvedFundName || '—' };
      });

      const paidFundsNormalized = paidFundsRaw
        .map((m) => {
          const resolvedFundId = m.fundoId || (m.projetoId ? (paidFundProjectMap.get(m.projetoId) ?? '') : '');
          return { ...m, fundoId: resolvedFundId };
        })
        .filter((m) => Boolean(m.fundoId));

      const paid = normalized.filter((m) => m.status === 'pago');
      const paidIn = paid.filter((m) => m.tipo === 'entrada');
      const paidOut = paid.filter((m) => m.tipo === 'saida');

      const entradas = paidIn.reduce((acc, m) => acc + m.valorTotal, 0);
      const saidas = paidOut.reduce((acc, m) => acc + m.valorTotal, 0);
      const pendencias = normalized.filter((m) => m.status === 'pendente').reduce((acc, m) => acc + m.valorTotal, 0);

      const { totalSaldoGeral } = computeFundBalances(fundsList, paidFundsNormalized);
      const saldoAtual = totalSaldoGeral;

      const fluxoMap = new Map<string, { periodo: string; entradas: number; saidas: number }>();
      const pizzaMap = new Map<string, number>();
      const realMap = new Map<string, number>();

      for (const row of paid) {
        const period = monthKey(row.data);
        const current = fluxoMap.get(period) ?? { periodo: period, entradas: 0, saidas: 0 };
        if (row.tipo === 'entrada') current.entradas += row.valorTotal;
        if (row.tipo === 'saida') current.saidas += row.valorTotal;
        fluxoMap.set(period, current);

        if (row.tipo === 'saida') {
          const cat = row.categoria || 'Sem categoria';
          pizzaMap.set(cat, (pizzaMap.get(cat) ?? 0) + row.valorTotal);
          realMap.set(period, (realMap.get(period) ?? 0) + row.valorTotal);
        }
      }

      const periods = buildPeriodsBetween(start, end);
      const totalOrcadoPeriodo = fundsList.reduce((acc, f) => acc + (Number.isFinite(f.totalOrcado) ? f.totalOrcado : 0), 0);
      const orcadoMensal = periods.length > 0 ? totalOrcadoPeriodo / periods.length : 0;

      return {
        entradas,
        saidas,
        saldoAtual,
        pendencias,
        fluxoCaixa: periods.map((periodo) => fluxoMap.get(periodo) ?? { periodo, entradas: 0, saidas: 0 }),
        distribuicaoCategoria: Array.from(pizzaMap.entries()).map(([categoria, valor]) => ({ categoria, valor })),
        orcadoVsReal: periods.map((periodo) => ({ periodo, orcado: orcadoMensal, real: realMap.get(periodo) ?? 0 })),
      };
    } catch {
      return DEFAULT_DASHBOARD;
    }
  }, [listFunds]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fundsList = await listFunds();
      const projectsList = await listProjects(fundsList);

      const { data: paidFundsMovementsData, error: paidFundsMovementsError } = await buildMovementsQuery({ status: 'pago' });
      ensure(paidFundsMovementsError, 'Falha ao carregar saldo dos fundos.');

      const paidFundsMovementsRaw = (paidFundsMovementsData || []).map((row) => mapMovement(row as AnyRow));
      const projectFundById = new Map(projectsList.map((project) => [project.id, project.fundoId]));
      const paidFundsMovements = paidFundsMovementsRaw
        .map((m) => {
          const resolvedFundId = m.fundoId || (m.projetoId ? (projectFundById.get(m.projetoId) ?? '') : '');
          return { ...m, fundoId: resolvedFundId };
        })
        .filter((m) => Boolean(m.fundoId));

      const fundBalances = computeFundBalances(fundsList, paidFundsMovements);
      const fundsWithCalculatedBalance = fundsList.map((fund) => {
        const summary = fundBalances.byFundId.get(fund.id);
        const saldoCalculado = summary?.saldo ?? (Number(fund.saldoInicial) || 0);
        const saidasCalculadas = summary?.saidas ?? 0;
        const entradasCalculadas = summary?.entradas ?? 0;

        return {
          ...fund,
          saldoAtual: saldoCalculado,
          totalEntradas: entradasCalculadas,
          totalSaidas: saidasCalculadas,
          totalGasto: saidasCalculadas,
        };
      });

      setFunds(fundsWithCalculatedBalance);
      setProjects(projectsList);

      const [latest, categoriesList, aggregates] = await Promise.all([
        (async () => {
          const { data, error: movementsError } = await buildMovementsQuery({ limit: 10 });
          ensure(movementsError, 'Falha ao listar movimentações.');
          const raw = (data || []).map((row) => mapMovement(row as AnyRow));
          const p2f = new Map(projectsList.map((p) => [p.id, p.fundoId]));
          const fById = new Map(fundsList.map((f) => [f.id, f.nome]));
          const pById = new Map(projectsList.map((p) => [p.id, p.nome]));

          return raw.map((m) => {
            const resolvedFundId = m.fundoId || (m.projetoId ? (p2f.get(m.projetoId) ?? '') : '');
            const resolvedFundName = resolvedFundId ? (fById.get(resolvedFundId) ?? m.fundo) : m.fundo;

            const resolvedProjectName =
              m.projetoNome !== '—'
                ? m.projetoNome
                : m.projetoId
                  ? (pById.get(m.projetoId) ?? m.projetoNome)
                  : m.projetoNome;

            return { ...m, fundoId: resolvedFundId, fundo: resolvedFundName || '—', projetoNome: resolvedProjectName || '—' };
          });
        })(),
        listCategories(),
        getDashboardAggregates(),
      ]);

      setMovements(latest);
      setCategories(categoriesList);
      setDashboard(aggregates ?? DEFAULT_DASHBOARD);
    } catch (loadError) {
      setError((loadError as Error).message);
      setDashboard(DEFAULT_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [getDashboardAggregates, listCategories, listFunds, listProjects]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAndReload = useCallback(async <T,>(runner: () => Promise<T>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await runner();
      await load();
      return result;
    } catch (runnerError) {
      const message = (runnerError as Error).message || 'Falha ao salvar.';
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [load]);

  const createFund = useCallback(async (payload: FundPayload) => runAndReload(async () => {
    const { error: createError } = await supabase
      .from('finance_funds')
      .insert({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') });
    ensure(createError, 'Falha ao criar fundo.');
    return true;
  }), [runAndReload]);

  const updateFund = useCallback(async (id: string, payload: FundPayload) => runAndReload(async () => {
    const { error: updateError } = await supabase
      .from('finance_funds')
      .update({ ...payload, opening_balance: toNumber(payload.opening_balance), status: normalizeStatus(payload.status, 'ativo') })
      .eq('id', id);
    ensure(updateError, 'Falha ao atualizar fundo.');
    return true;
  }), [runAndReload]);

  const deleteFund = useCallback(async (id: string) => runAndReload(async () => {
    const { error: deleteError } = await supabase.from('finance_funds').delete().eq('id', id);
    ensure(deleteError, 'Falha ao excluir fundo.');
    return true;
  }), [runAndReload]);

  // ✅ cria fundo próprio automaticamente quando necessário
  const createProject = useCallback(async (payload: ProjectPayload) => runAndReload(async () => {
    const initial = toNumber(payload.initial_amount);

    const isMisto = !payload.fund_id && initial === 0;
    let fundIdToUse: string | null = payload.fund_id ? String(payload.fund_id) : null;

    // Se NÃO é misto e veio sem fund_id, cria fundo próprio
    if (!isMisto && !fundIdToUse) {
      const fundInsert = await supabase
        .from('finance_funds')
        .insert({
          name: `Fundo - ${String(payload.name).trim() || 'Projeto'}`,
          year: payload.year,
          description: `Fundo próprio do projeto: ${String(payload.name).trim()}`,
          opening_balance: initial,
          status: 'ativo',
        })
        .select('id')
        .single();

      ensure(fundInsert.error, 'Falha ao criar fundo próprio do projeto.');
      fundIdToUse = String(fundInsert.data.id);
    }

    const { error: createError } = await supabase
      .from('finance_projects')
      .insert({
        ...payload,
        fund_id: isMisto ? null : fundIdToUse,
        initial_amount: isMisto ? 0 : initial,
        current_balance: isMisto ? 0 : initial,
        status: normalizeStatus(payload.status, 'em_andamento'),
      });

    ensure(createError, 'Falha ao criar projeto.');
    return true;
  }), [runAndReload]);

  const updateProject = useCallback(async (id: string, payload: ProjectPayload) => runAndReload(async () => {
    const initial = toNumber(payload.initial_amount);
    const isMisto = !payload.fund_id && initial === 0;

    const { error: updateError } = await supabase
      .from('finance_projects')
      .update({
        ...payload,
        fund_id: isMisto ? null : (payload.fund_id || null),
        initial_amount: isMisto ? 0 : initial,
        status: normalizeStatus(payload.status, 'em_andamento'),
      })
      .eq('id', id);

    ensure(updateError, 'Falha ao atualizar projeto.');
    return true;
  }), [runAndReload]);

  const deleteProject = useCallback(async (id: string) => runAndReload(async () => {
    const { error: deleteError } = await supabase.from('finance_projects').delete().eq('id', id);
    ensure(deleteError, 'Falha ao excluir projeto.');
    return true;
  }), [runAndReload]);

  const toMovementDbPayload = (payload: MovementPayload) => {
    const qty = Math.max(1, toNumber(payload.quantity || 1));
    const unit = toNumber(payload.unit_value);
    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim();
    if (!title) throw new Error('Título é obrigatório.');
    if (!description) throw new Error('Descrição é obrigatória.');
    if (!payload.fund_id && !payload.project_id) throw new Error('Selecione ao menos um fundo ou projeto.');
    if (!payload.category_id) throw new Error('Categoria é obrigatória.');
    return {
      date: payload.date,
      type: normalizeType(payload.type),
      fund_id: payload.fund_id || null,
      project_id: payload.project_id || null,
      category_id: payload.category_id || null,
      title,
      description,
      unit_value: unit,
      quantity: qty,
      total_value: payload.total_value !== undefined ? toNumber(payload.total_value) : unit * qty,
      status: normalizeMovementStatus(payload.status),
      pay_method: normalizePayMethod(payload.pay_method),
      beneficiary: payload.beneficiary || null,
      notes: payload.notes || null,
      doc_type: payload.doc_type || null,
      doc_number: payload.doc_number || null,
      cost_center: payload.cost_center || null,
    };
  };

  const insertMovement = async (payload: MovementPayload) => {
    const base = toMovementDbPayload(payload);
    const result = await supabase.from('finance_movements').insert(base).select('id').single();
    ensure(result.error, 'Falha ao criar movimentação.');
    return String(result.data.id);
  };

  const createMovement = useCallback(async (payload: MovementPayload) => runAndReload(async () => {
    const movementId = await insertMovement(payload);
    const list = await listMovements();
    const created = list.find((m) => m.id === movementId) ?? ({ id: movementId } as any);
    return created;
  }), [runAndReload, listMovements]);

  const updateMovement = useCallback(async (id: string, payload: MovementPayload) => runAndReload(async () => {
    const base = toMovementDbPayload(payload);
    const result = await supabase.from('finance_movements').update(base).eq('id', id);
    ensure(result.error, 'Falha ao atualizar movimentação.');
    return true;
  }), [runAndReload]);

  const getSignedUrl = useCallback(async (storagePath: string) => {
    const { data, error: signedError } = await supabase.storage.from('finance-attachments').createSignedUrl(storagePath, 60 * 10);
    ensure(signedError, 'Falha ao gerar URL assinada.');
    return data.signedUrl;
  }, []);

  const uploadAttachment = useCallback(async (file: File, context: { movementId: string; fundId?: string; projectId?: string }) => {
    const { movementId, fundId, projectId } = context;
    const safeName = file.name.replaceAll(' ', '_');
    const path = `${fundId || 'sem-fundo'}/${projectId || 'sem-projeto'}/${movementId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from('finance-attachments').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    ensure(uploadError, 'Falha ao enviar anexo para o storage.');

    const { error: insertError } = await supabase.from('finance_attachments').insert({ movement_id: movementId, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size });
    ensure(insertError, 'Falha ao registrar metadados do anexo.');
    return true;
  }, []);

  const listAttachmentsForMovementIds = useCallback(async (movementIds: string[]) => {
    if (movementIds.length === 0) return new Map<string, number>();
    const { data, error: attachmentsError } = await supabase.from('finance_attachments').select('movement_id').in('movement_id', movementIds);
    ensure(attachmentsError, 'Falha ao listar anexos das movimentações.');
    const map = new Map<string, number>();
    (data || []).forEach((row: any) => {
      const key = String(row.movement_id);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, []);

  const deleteAttachment = useCallback(async (attachmentId: string) => runAndReload(async () => {
    const { data, error: readError } = await supabase.from('finance_attachments').select('id,storage_path').eq('id', attachmentId).single();
    ensure(readError, 'Falha ao localizar anexo para exclusão.');

    const storagePath = String((data as any).storage_path || '');
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from('finance-attachments').remove([storagePath]);
      ensure(storageError, 'Falha ao remover arquivo do storage.');
    }

    const { error: deleteError } = await supabase.from('finance_attachments').delete().eq('id', attachmentId);
    ensure(deleteError, 'Falha ao excluir metadados do anexo.');
    return true;
  }), [runAndReload]);

  const deleteMovementCascade = useCallback(async (id: string) => runAndReload(async () => {
    const attachments = await listAttachments(id);
    const paths = attachments.map((item) => item.storage_path).filter(Boolean);

    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('finance-attachments').remove(paths);
      ensure(removeError, 'Falha ao remover anexos da movimentação.');
      const { error: attachmentsError } = await supabase.from('finance_attachments').delete().eq('movement_id', id);
      ensure(attachmentsError, 'Falha ao excluir anexos da movimentação.');
    }

    const { error: movementError } = await supabase.from('finance_movements').delete().eq('id', id);
    ensure(movementError, 'Falha ao excluir movimentação.');
    return true;
  }), [listAttachments, runAndReload]);

  const getReportMovements = useCallback(async (filters: ReportFilters) => {
    const base: MovementFilters = { startDate: filters.startDate, endDate: filters.endDate, status: filters.status };

    if (filters.mode === 'fundo') {
      const list = await listMovements({ startDate: filters.startDate, endDate: filters.endDate, status: filters.status });
      const target = filters.fundId || '';
      return list.filter((m) => (m.fundoId || '') === target);
    }

    if (filters.mode === 'projeto') base.projectId = filters.projectId;
    return listMovements(base);
  }, [listMovements]);

  const summarizeMovements = (list: FinanceiroMovimentacao[]): ReportSummary => {
    const entradas = list.filter((m) => m.status === 'pago' && m.tipo === 'entrada').reduce((acc, m) => acc + m.valorTotal, 0);
    const saidas = list.filter((m) => m.status === 'pago' && m.tipo === 'saida').reduce((acc, m) => acc + m.valorTotal, 0);
    const pendencias = list.filter((m) => m.status === 'pendente').reduce((acc, m) => acc + m.valorTotal, 0);
    return { entradas, saidas, saldo: entradas - saidas, pendencias };
  };

  const generateReportPdf = useCallback(async (filters: ReportFilters, opts?: { logoDataUrl?: string | null; fileName?: string }) => {
    const list = await getReportMovements(filters);
    const summary = summarizeMovements(list);

    const fundName = filters.fundId ? (fundsById.get(filters.fundId) ?? '—') : '—';
    const projectName = filters.projectId ? (projectsById.get(filters.projectId) ?? '—') : '—';

    const html = buildReportHtml({
      title: opts?.fileName ?? 'relatorio-financeiro',
      logoDataUrl: opts?.logoDataUrl ?? null,
      filters,
      summary,
      list,
      fundName,
      projectName,
    });

    openPrint(html, 'Relatório Financeiro');
    return { ok: true, total: list.length };
  }, [fundsById, projectsById, getReportMovements]);

  return {
    funds,
    projects,
    movements,
    dashboard: safeDashboard,
    categories,
    loading,
    saving,
    error,
    load,

    listFunds,
    createFund,
    updateFund,
    deleteFund,

    listProjects,
    createProject,
    updateProject,
    deleteProject,

    listMovements,
    listLatestMovements,
    getDashboardAggregates,
    listCategories,

    createMovement,
    updateMovement,

    uploadAttachment,
    deleteAttachment,
    listAttachments,
    listAttachmentsForMovementIds,
    getSignedUrl,
    deleteMovementCascade,

    generateReportPdf,
  };
}
