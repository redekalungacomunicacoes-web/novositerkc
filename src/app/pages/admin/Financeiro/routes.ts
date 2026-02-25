import { createBrowserRouter } from 'react-router';
import { MainLayout } from './layouts/MainLayout';
import {
  Dashboard,
  Fundos,
  FundoDetalhes,
  Projetos,
  ProjetoDetalhes,
} from './pages/admin/Financeiro';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      {
        index: true,
        Component: Dashboard,
      },
      {
        path: 'admin/financeiro',
        children: [
          {
            index: true,
            Component: Fundos,
          },
          {
            path: 'fundo/:id',
            Component: FundoDetalhes,
          },
          {
            path: 'projetos',
            Component: Projetos,
          },
          {
            path: 'projeto/:id',
            Component: ProjetoDetalhes,
          },
        ],
      },
    ],
  },
]);