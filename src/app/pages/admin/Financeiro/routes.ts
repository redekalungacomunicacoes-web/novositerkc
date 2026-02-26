import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard, Fundos, FundoDetalhes, Projetos, ProjetoDetalhes } from './index';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      {
        path: 'admin/financeiro',
        children: [
          { index: true, Component: Dashboard },
          { path: 'dashboard', Component: Dashboard },

          { path: 'fundos', Component: Fundos },
          { path: 'fundos/:id', Component: FundoDetalhes },

          { path: 'projetos', Component: Projetos },
          { path: 'projetos/:id', Component: ProjetoDetalhes },

          // mantidos por compatibilidade, mas agora o dashboard já tem o botão de relatório
          { path: 'movimentacoes', Component: Dashboard },
          { path: 'relatorios', Component: Dashboard },
        ],
      },
    ],
  },
]);
