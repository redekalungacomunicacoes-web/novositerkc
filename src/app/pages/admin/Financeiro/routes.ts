import { lazy } from "react";
import { type RouteObject } from "react-router-dom";

const Dashboard = lazy(() => import("./Dashboard").then(m => ({ default: m.Dashboard })));
const Fundos = lazy(() => import("./Fundos").then(m => ({ default: m.Fundos })));
const FundoDetalhes = lazy(() => import("./FundoDetalhes").then(m => ({ default: m.FundoDetalhes })));
const Projetos = lazy(() => import("./Projetos").then(m => ({ default: m.Projetos })));
const ProjetoDetalhes = lazy(() => import("./ProjetoDetalhes").then(m => ({ default: m.ProjetoDetalhes })));

export const financeiroRoutes: RouteObject[] = [
  { index: true, element: <Dashboard /> },
  { path: "dashboard", element: <Dashboard /> },
  { path: "fundos", element: <Fundos /> },
  { path: "fundos/:id", element: <FundoDetalhes /> },
  { path: "projetos", element: <Projetos /> },
  { path: "projetos/:id", element: <ProjetoDetalhes /> },
  { path: "movimentacoes", element: <Dashboard /> },
  { path: "relatorios", element: <Dashboard /> },
];