import { createBrowserRouter } from 'react-router';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard, Fundos, FundoDetalhes, Projetos, ProjetoDetalhes, Relatorios } from './index';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      {
        path: 'admin/financeiro',
        children: [
          { path: 'dashboard', Component: Dashboard },
          { index: true, Component: Dashboard },
          { path: 'fundos', Component: Fundos },
          { path: 'fundos/:id', Component: FundoDetalhes },
          { path: 'projetos', Component: Projetos },
          { path: 'projetos/:id', Component: ProjetoDetalhes },
          { path: 'movimentacoes', Component: Dashboard },
          { path: 'relatorios', Component: Relatorios },
        ],
      },
    ],
  },
]);
