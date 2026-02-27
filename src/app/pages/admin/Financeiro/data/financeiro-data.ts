// Dados mockados para o módulo Financeiro

export const PLANEJAMENTO_ITEMS = [
  {
    id: '1',
    item: 'Produção cultural, escrita e elaboração do pro...',
    categoria: 'DESPESA DE PESSOAL',
    inicioPrevisto: '2025-02-01',
    fimPrevisto: '2025-10-01',
    quantidade: 1,
    valorUnitario: 12000.00,
    totalOrcado: 12000.00,
    observacoes: 'Coordenação de projetos culturais e desenvolvimento de propostas',
    gastoReal: 8400.00,
    diferenca: -3600.00,
    percentualExecucao: 70
  },
  {
    id: '2',
    item: 'Planejamento e execução da comunicação institucional...',
    categoria: 'COMUNICAÇÃO E CADASTRO',
    inicioPrevisto: '2025-01-01',
    fimPrevisto: '2025-12-01',
    quantidade: 1,
    valorUnitario: 7000.00,
    totalOrcado: 7000.00,
    observacoes: 'Gestão de redes sociais, campanhas e identidade visual',
    gastoReal: 5250.00,
    diferenca: -1750.00,
    percentualExecucao: 75
  },
  {
    id: '3',
    item: 'Aquisição de materiais pedagógicos, equipamentos...',
    categoria: 'EQUIPAMENTOS',
    inicioPrevisto: '2025-03-01',
    fimPrevisto: '2025-12-01',
    quantidade: 1,
    valorUnitario: 4000.00,
    totalOrcado: 4000.00,
    observacoes: 'Computadores, tablets e materiais didáticos',
    gastoReal: 3200.00,
    diferenca: -800.00,
    percentualExecucao: 80
  },
  {
    id: '4',
    item: 'Estruturação institucional e administrativa...',
    categoria: 'OUTROS',
    inicioPrevisto: '2025-07-01',
    fimPrevisto: '2025-12-02',
    quantidade: 1,
    valorUnitario: 2000.00,
    totalOrcado: 2000.00,
    observacoes: 'Regularização documentação, taxas e seguros',
    gastoReal: 1500.00,
    diferenca: -500.00,
    percentualExecucao: 75
  },
  {
    id: '5',
    item: 'Planejamento, organização e realização do evento...',
    categoria: 'LOGÍSTICA PARA A OPERAÇÃO',
    inicioPrevisto: '2025-09-01',
    fimPrevisto: '2025-09-01',
    quantidade: 1,
    valorUnitario: 22000.00,
    totalOrcado: 22000.00,
    observacoes: 'Evento Rede Integra - locação, transporte, montagem',
    gastoReal: 0,
    diferenca: -22000.00,
    percentualExecucao: 0
  },
  {
    id: '6',
    item: 'Desdobramentos do evento Rede Integra...',
    categoria: 'OUTROS',
    inicioPrevisto: '2025-09-01',
    fimPrevisto: '2025-12-02',
    quantidade: 1,
    valorUnitario: 3000.00,
    totalOrcado: 3000.00,
    observacoes: 'Follow-up, produção de conteúdo pós-evento',
    gastoReal: 0,
    diferenca: -3000.00,
    percentualExecucao: 0
  },
  {
    id: '7',
    item: 'Aquisição de gêneros alimentícios e custeio...',
    categoria: 'ALIMENTAÇÃO E CUIDADO COM A EQUIPE',
    inicioPrevisto: '2025-02-01',
    fimPrevisto: '2025-12-02',
    quantidade: 1,
    valorUnitario: 4000.00,
    totalOrcado: 4000.00,
    observacoes: 'Alimentação durante reuniões e eventos',
    gastoReal: 2800.00,
    diferenca: -1200.00,
    percentualExecucao: 70
  },
  {
    id: '8',
    item: 'Redação, revisão técnica e assessoria...',
    categoria: 'OUTROS',
    inicioPrevisto: '2025-08-01',
    fimPrevisto: '2025-12-02',
    quantidade: 1,
    valorUnitario: 5000.00,
    totalOrcado: 5000.00,
    observacoes: 'Consultoria jurídica e contábil',
    gastoReal: 2500.00,
    diferenca: -2500.00,
    percentualExecucao: 50
  },
  {
    id: '9',
    item: 'Contratação de serviços digitais e ferramentas...',
    categoria: 'COMUNICAÇÃO E CADASTRO',
    inicioPrevisto: '2025-02-01',
    fimPrevisto: '2025-12-02',
    quantidade: 1,
    valorUnitario: 3000.00,
    totalOrcado: 3000.00,
    observacoes: 'Assinaturas de softwares, domínio, hospedagem',
    gastoReal: 2100.00,
    diferenca: -900.00,
    percentualExecucao: 70
  },
  {
    id: '10',
    item: 'Captação de recursos, produção executiva...',
    categoria: 'DESPESA DE PESSOAL',
    inicioPrevisto: '2025-09-01',
    fimPrevisto: '2025-12-02',
    quantidade: 1,
    valorUnitario: 6000.00,
    totalOrcado: 6000.00,
    observacoes: 'Consultoria em captação de recursos',
    gastoReal: 0,
    diferenca: -6000.00,
    percentualExecucao: 0
  },
  {
    id: '11',
    item: 'Direção, coordenação e gestão da Rede...',
    categoria: 'DESPESA DE PESSOAL',
    inicioPrevisto: '2025-01-01',
    fimPrevisto: '2025-12-02',
    quantidade: 1,
    valorUnitario: 12700.00,
    totalOrcado: 12700.00,
    observacoes: 'Coordenação geral do programa',
    gastoReal: 7620.00,
    diferenca: -5080.00,
    percentualExecucao: 60
  },
  {
    id: '12',
    item: 'Planejamento, organização e realização da Oficina...',
    categoria: 'DESPESA DE PESSOAL',
    inicioPrevisto: '2025-11-01',
    fimPrevisto: '2025-11-01',
    quantidade: 1,
    valorUnitario: 19300.00,
    totalOrcado: 19300.00,
    observacoes: 'Oficina intensiva de formação',
    gastoReal: 0,
    diferenca: -19300.00,
    percentualExecucao: 0
  },
];

export const FUNDOS = [
  {
    id: 'jornalismo',
    nome: 'Jornalismo',
    ano: 2026,
    totalOrcado: 50000.00,
    saldoInicial: 50000.00,
    saldoAtual: 49500.00,
    totalGasto: 500.00,
    totalEntradas: 0,
    totalSaidas: 500.00,
    status: 'ativo' as const,
    execucao: 1.0,
  },
  {
    id: 'unibanco',
    nome: 'Unibanco',
    ano: 2026,
    totalOrcado: 10000.00,
    saldoInicial: 10000.00,
    saldoAtual: 10000.00,
    totalGasto: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    status: 'ativo' as const,
    execucao: 0,
  },
];

export const PROJETOS = [
  {
    id: 'oficina',
    nome: 'Oficina',
    fundo: 'Jornalismo',
    fundoId: 'jornalismo',
    saldoDisponivel: 49500.00,
    totalOrcado: 50000.00,
    gastoReal: 500.00,
    diferenca: -49500.00,
    execucao: 1.0,
    status: 'em_andamento' as const,
  },
];

export const MOVIMENTACOES = [
  {
    id: 'mov-001',
    data: '2024-02-24',
    tipo: 'saida' as const,
    projeto: 'Oficina',
    projetoId: 'oficina',
    fundo: 'Jornalismo',
    fundoId: 'jornalismo',
    itemPlanejamentoId: '1',
    categoria: 'DESPESA DE PESSOAL',
    descricao: 'mercado',
    valorUnitario: 500.00,
    quantidade: 1,
    valorTotal: 500.00,
    status: 'pago' as const,
    favorecido: 'Maria Silva Santos',
    tipoDocumento: 'CPF',
    numeroDocumento: '123.456.789-00',
    observacoes: '',
    comprovantes: [],
  },
];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

export const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};
