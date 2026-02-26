import { supabase } from '@/lib/supabase';

export type FinanceStatus =
  | 'pago'
  | 'pendente'
  | 'cancelado'
  | 'ativo'
  | 'em_andamento'
  | 'concluido';

export type FinanceiroFundo = {
  id: string;
  nome: string;
  ano: number;
  totalOrcado: number;
  saldoInicial: number;
  saldoAtual: number;
  totalGasto: number;
  totalEntradas: number;
  totalSaidas: number;
  status: FinanceStatus;
  execucao: number;
};

export type FinanceiroProjeto = {
  id: string;
  nome: string;
  fundo: string;
  fundoId: string;
  saldoDisponivel: number;
  totalOrcado: number;
  gastoReal: number;
  diferenca: number;
  execucao: number;
  status: FinanceStatus;
};

export type FinanceAttachment = {
  id: string;
  movement_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  public_url?: string;
  created_at: string;
};

export type FinanceiroMovimentacao = {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  titulo: string;
  descricao: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
  status: 'pago' | 'pendente' | 'cancelado';
  projetoNome: string;
  projetoId: string;
  fundo: string;
  fundoId: string;
  categoria: string;
  categoriaId: string;
  payMethod: 'pix' | 'transferencia' | 'dinheiro';
  beneficiary: string;
  notes: string;
  docType?: string;
  docNumber?: string;
  costCenter?: string;
  attachmentsCount: number;
  comprovantes: FinanceAttachment[];
};

export type DashboardData = {
  kpis: {
    totalFunds: number;
    totalProjects: number;
    currentBalanceFunds: number;
    currentBalanceProjects: number;
    totalInPaid: number;
    totalOutPaid: number;
    totalPending: number;
    totalMovements: number;
    budgetTotal: number;
    budgetReal: number;
    executionPct: number;
    attachmentsPct: number;
    noDocumentCount: number;
  };
  cashflowLine: { mes: string; entradas: number; saidas: number }[];
  budgetVsReal: { mes: string; orcado: number; real: number }[];
  categoryPie: { name: string; value: number }[];
  latestMovements: {
    id: string;
    date: string;
    type: 'entrada' | 'saida';
    description: string;
    fund_id?: string;
    project_id?: string;
    total_value: number;
    status: 'pago' | 'pendente' | 'cancelado';
    category_id?: string;
    category_name: string;
    attachments_count: number;
  }[];
  entradas: number;
  saidas: number;
  saldoAtual: number;
  pendencias: number;
  fluxoCaixa: { periodo: string; entradas: number; saidas: number }[];
  distribuicaoCategoria: { categoria: string; valor: number }[];
  orcadoVsReal: { periodo: string; orcado: number; real: number }[];
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

export const formatDate = (dateLike: string) => {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

export async function getDashboardData(): Promise<DashboardData> {
  const { data } = await supabase.from('v_finance_movements_enriched').select('*').limit(1);
  if (data) {
    return {
      kpis: {
        totalFunds: 0,
        totalProjects: 0,
        currentBalanceFunds: 0,
        currentBalanceProjects: 0,
        totalInPaid: 0,
        totalOutPaid: 0,
        totalPending: 0,
        totalMovements: 0,
        budgetTotal: 0,
        budgetReal: 0,
        executionPct: 0,
        attachmentsPct: 0,
        noDocumentCount: 0,
      },
      cashflowLine: [],
      budgetVsReal: [],
      categoryPie: [],
      latestMovements: [],
      entradas: 0,
      saidas: 0,
      saldoAtual: 0,
      pendencias: 0,
      fluxoCaixa: [],
      distribuicaoCategoria: [],
      orcadoVsReal: [],
    };
  }
  return {
    kpis: {
      totalFunds: 0,
      totalProjects: 0,
      currentBalanceFunds: 0,
      currentBalanceProjects: 0,
      totalInPaid: 0,
      totalOutPaid: 0,
      totalPending: 0,
      totalMovements: 0,
      budgetTotal: 0,
      budgetReal: 0,
      executionPct: 0,
      attachmentsPct: 0,
      noDocumentCount: 0,
    },
    cashflowLine: [],
    budgetVsReal: [],
    categoryPie: [],
    latestMovements: [],
    entradas: 0,
    saidas: 0,
    saldoAtual: 0,
    pendencias: 0,
    fluxoCaixa: [],
    distribuicaoCategoria: [],
    orcadoVsReal: [],
  };
}
