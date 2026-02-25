# Módulo Financeiro

Módulo completo de gestão financeira para painel administrativo.

## Estrutura de Arquivos

```
Financeiro/
├── components/          # Componentes reutilizáveis
│   ├── KPICard.tsx     # Card de KPI
│   └── StatusBadge.tsx # Badge de status
├── data/               # Dados mockados
│   └── financeiro-data.ts
├── Dashboard.tsx       # Dashboard principal
├── Fundos.tsx          # Lista de fundos
├── FundoDetalhes.tsx   # Detalhes de um fundo
├── Projetos.tsx        # Lista de projetos
├── ProjetoDetalhes.tsx # Detalhes de um projeto (com abas)
└── index.tsx           # Exports
```

## Rotas

- `/` - Dashboard Financeiro
- `/admin/financeiro` - Lista de Fundos
- `/admin/financeiro/fundo/:id` - Detalhes do Fundo
- `/admin/financeiro/projetos` - Lista de Projetos
- `/admin/financeiro/projeto/:id` - Detalhes do Projeto

## Funcionalidades

### Dashboard
- KPIs: Saldo Total, Entradas, Saídas, Movimentações
- Gráfico de Fluxo de Caixa
- Gráfico Orçado vs Real
- Distribuição por Categoria
- Últimas Movimentações

### Fundos
- Cards visuais com informações do fundo
- Saldo, execução, orçamento
- Ações: Ver Detalhes, Editar, Excluir

### Fundo Detalhes
- KPIs do fundo
- Gráficos de análise
- Tabela de movimentações
- Busca e filtros

### Projetos
- Grid de cards
- Busca e filtros
- Estatísticas por projeto
- Ações rápidas

### Projeto Detalhes (Abas)
- **Visão Geral**: Gráficos e resumo
- **Caixa**: Movimentações detalhadas
- **Prestação de Contas**: Checklist de comprovantes
- **Relatórios**: Opções de export (PDF/CSV)

## Design System

### Cores
- Primary: `#0f3d2e` (Verde escuro)
- Accent: `#ffdd9a` (Dourado suave)
- Background: `#ffffff` / `#f9fafb`

### Componentes
- Cards com `border-radius: 12px`
- Shadows suaves
- Espaçamento: 8/16/24/32px
- Tipografia moderna

## Dados Mockados

Os dados estão em `/data/financeiro-data.ts` e incluem:
- FUNDOS (Jornalismo, Unibanco)
- PROJETOS (Oficina)
- MOVIMENTACOES
- Funções de formatação (currency, date, percent)
