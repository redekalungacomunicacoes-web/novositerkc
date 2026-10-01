import { createElement, lazy } from "react";
import { type RouteObject } from "react-router-dom";

const Dashboard = lazy(() => import("./Dashboard").then(m => ({ default: m.Dashboard })));
const Fundos = lazy(() => import("./Fundos").then(m => ({ default: m.Fundos })));
const FundoDetalhes = lazy(() => import("./FundoDetalhes").then(m => ({ default: m.FundoDetalhes })));
const Projetos = lazy(() => import("./Projetos").then(m => ({ default: m.Projetos })));
const ProjetoDetalhes = lazy(() => import("./ProjetoDetalhes").then(m => ({ default: m.ProjetoDetalhes })));

export const financeiroRoutes: RouteObject[] = [
  { index: true, element: createElement(Dashboard) },
  { path: "dashboard", element: createElement(Dashboard) },
  { path: "fundos", element: createElement(Fundos) },
  { path: "fundos/:id", element: createElement(FundoDetalhes) },
  { path: "projetos", element: createElement(Projetos) },
  { path: "projetos/:id", element: createElement(ProjetoDetalhes) },
  { path: "movimentacoes", element: createElement(Dashboard) },
  { path: "relatorios", element: createElement(Dashboard) },
];