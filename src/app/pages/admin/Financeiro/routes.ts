import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard, Fundos, FundoDetalhes, Projetos, ProjetoDetalhes } from './index';
import { RequireFinanceRole } from './components/RequireFinanceRole';

export const router = createBrowserRouter([
  {
  path: 'admin/financeiro',
  element: (
    <RequireFinanceRole>
      <Dashboard />
    </RequireFinanceRole>
  ),
  children: [
    { index: true, Component: Dashboard },
    { path: 'dashboard', Component: Dashboard },

    { path: 'fundos', Component: Fundos },
    { path: 'fundos/:id', Component: FundoDetalhes },

    { path: 'projetos', Component: Projetos },
    { path: 'projetos/:id', Component: ProjetoDetalhes },

    { path: 'movimentacoes', Component: Dashboard },
    { path: 'relatorios', Component: Dashboard },
  ],
}
