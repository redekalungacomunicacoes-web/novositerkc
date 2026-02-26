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

/**
 * Mantive a função, mas ela agora não é usada como “cérebro” do dashboard.
 * O dashboard fica 100% no hook (useFinanceSupabase), para cruzar fundo/projeto corretamente.
 */
export async function getDashboardData(): Promise<DashboardData> {
  // (compat) caso você use em algum lugar antigo
  const { error } = await supabase.from('v_finance_movements_enriched').select('id').limit(1);
  if (error) {
    // fallback seguro
    return { entradas: 0, saidas: 0, saldoAtual: 0, pendencias: 0, fluxoCaixa: [], distribuicaoCategoria: [], orcadoVsReal: [] };
  }
  return { entradas: 0, saidas: 0, saldoAtual: 0, pendencias: 0, fluxoCaixa: [], distribuicaoCategoria: [], orcadoVsReal: [] };
}
