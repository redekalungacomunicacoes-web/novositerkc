import { Movement } from "../types/financial";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AccountabilityTab({ movements }: { movements: Movement[] }) {
  const grouped = Object.values(
    movements.reduce((acc: any, m) => {
      const key = `${m.category?.name || "Sem categoria"}__${m.status}`;
      if (!acc[key]) acc[key] = { category: m.category?.name || "Sem categoria", status: m.status, total: 0, count: 0 };
      acc[key].total += Number(m.total_value);
      acc[key].count += 1;
      return acc;
    }, {})
  );

  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50"><tr><th className="p-2 text-left">Categoria</th><th className="p-2 text-left">Status</th><th className="p-2">Qtd</th><th className="p-2">Total</th></tr></thead>
        <tbody>{grouped.map((g: any) => <tr key={`${g.category}-${g.status}`} className="border-t"><td className="p-2">{g.category}</td><td className="p-2">{g.status}</td><td className="p-2 text-center">{g.count}</td><td className="p-2 text-right">{brl.format(g.total)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
