import { createBrowserRouter } from 'react-router';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard, Fundos, FundoDetalhes, Projetos, ProjetoDetalhes } from './index';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      {
        path: 'admin/financeiro',
        children: [
          { index: true, Component: Dashboard },
          { path: 'fundos', Component: Fundos },
          { path: 'fundos/:id', Component: FundoDetalhes },
          { path: 'projetos', Component: Projetos },
          { path: 'projetos/:id', Component: ProjetoDetalhes },
        ],
      },
    ],
  },
]);
