import { MovementStatus } from "../types/financial";

export function StatusBadge({ status }: { status: MovementStatus }) {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium";
  const map = {
    pago: "bg-green-100 text-green-700",
    pendente: "bg-amber-100 text-amber-700",
    cancelado: "bg-red-100 text-red-700",
  } as const;

  return <span className={`${base} ${map[status]}`}>{status}</span>;
}
