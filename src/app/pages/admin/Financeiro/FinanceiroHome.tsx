import { Dashboard as FigmaDashboard } from "./figma/pages/Dashboard";

export function FinanceiroHome() {
  // AdminLayout já cuida de padding e fundo; o layout do Figma mantém seus próprios cards e grids.
  return <FigmaDashboard />;
}
