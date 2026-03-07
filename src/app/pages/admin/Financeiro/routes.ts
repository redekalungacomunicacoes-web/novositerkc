import { type RouteObject } from "react-router-dom";
import { Dashboard, Fundos, FundoDetalhes, Projetos, ProjetoDetalhes } from "./index";

export const financeiroRoutes: RouteObject[] = [
  { index: true, Component: Dashboard },
  { path: "dashboard", Component: Dashboard },
  { path: "fundos", Component: Fundos },
  { path: "fundos/:id", Component: FundoDetalhes },
  { path: "projetos", Component: Projetos },
  { path: "projetos/:id", Component: ProjetoDetalhes },
  { path: "movimentacoes", Component: Dashboard },
  { path: "relatorios", Component: Dashboard },
];
