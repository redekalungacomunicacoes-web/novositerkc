import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Movement } from "../types/financial";
import { StatusBadge } from "../components/StatusBadge";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CashFlowTab({ movements, onEdit, onDelete }: { movements: Movement[]; onEdit: (m: Movement) => void; onDelete: (m: Movement) => void }) {
  const paid = movements.filter((m) => m.status === "pago");
  const byMonth = Object.values(
    paid.reduce((acc: any, m) => {
      const key = m.date.slice(0, 7);
      if (!acc[key]) acc[key] = { month: key, entradas: 0, saidas: 0 };
      acc[key][m.type === "entrada" ? "entradas" : "saidas"] += Number(m.total_value);
      return acc;
    }, {})
  );

  return (
    <div className="space-y-4">
      <div className="h-64 rounded border bg-card p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byMonth}>
            <XAxis dataKey="month" /><YAxis />
            <Bar dataKey="entradas" fill="#16a34a" />
            <Bar dataKey="saidas" fill="#dc2626" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Descrição</th><th className="p-2">Status</th><th className="p-2">Valor</th><th className="p-2" /></tr></thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{new Date(m.date).toLocaleDateString("pt-BR")}</td>
                <td className="p-2">{m.description}</td>
                <td className="p-2 text-center"><StatusBadge status={m.status} /></td>
                <td className="p-2 text-right">{brl.format(Number(m.total_value))}</td>
                <td className="p-2 text-right space-x-2">
                  <button className="text-blue-600" onClick={() => onEdit(m)}>Editar</button>
                  <button className="text-red-600" onClick={() => onDelete(m)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
