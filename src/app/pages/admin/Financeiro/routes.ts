import { lazy } from "react";
import { type RouteObject } from "react-router-dom";

const Dashboard = lazy(() => import("./Dashboard").then(m => ({ default: m.Dashboard })));
const Fundos = lazy(() => import("./Fundos").then(m => ({ default: m.Fundos })));
const FundoDetalhes = lazy(() => import("./FundoDetalhes").then(m => ({ default: m.FundoDetalhes })));
const Projetos = lazy(() => import("./Projetos").then(m => ({ default: m.Projetos })));
const ProjetoDetalhes = lazy(() => import("./ProjetoDetalhes").then(m => ({ default: m.ProjetoDetalhes })));

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