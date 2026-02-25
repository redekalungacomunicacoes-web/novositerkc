import { useLocation } from 'react-router-dom';
import { Dashboard as FigmaDashboard } from './figma/pages/Dashboard';
import { FinanceiroMovimentacoes } from './FinanceiroMovimentacoes';
import { FinanceiroRelatorios } from './FinanceiroRelatorios';

export function FinanceiroHome() {
  const { pathname } = useLocation();

  if (pathname.endsWith('/movimentacoes')) {
    return <FinanceiroMovimentacoes />;
  }

  if (pathname.endsWith('/relatorios')) {
    return <FinanceiroRelatorios />;
  }

  return <FigmaDashboard />;
}
