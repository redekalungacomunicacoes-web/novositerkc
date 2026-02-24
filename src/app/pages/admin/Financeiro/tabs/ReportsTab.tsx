import { Movement, Project } from "../types/financial";

export function ReportsTab({ project, movements }: { project: Project; movements: Movement[] }) {
  const exportCsv = () => {
    const rows = ["date,type,description,status,total_value", ...movements.map((m) => `${m.date},${m.type},\"${m.description}\",${m.status},${m.total_value}`)].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimentos-${project.name}.csv`;
    a.click();
  };

  const exportSummary = () => {
    const content = `Projeto: ${project.name}\nAno: ${project.year}\nSaldo atual: ${project.current_balance}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumo-${project.name}.txt`;
    a.click();
  };

  return <div className="flex gap-3"><button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={exportCsv}>Exportar CSV</button><button className="rounded border px-3 py-2" onClick={exportSummary}>Exportar Resumo</button></div>;
}
