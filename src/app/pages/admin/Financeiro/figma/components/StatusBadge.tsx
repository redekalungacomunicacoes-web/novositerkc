interface StatusBadgeProps {
  status: 'pago' | 'pendente' | 'cancelado' | 'ativo' | 'em_andamento' | 'concluido';
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const statusConfig = {
    pago: { label: 'Pago', color: 'bg-green-100 text-green-700 border-green-200' },
    pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200' },
    ativo: { label: 'Ativo', color: 'bg-[#0f3d2e] text-white border-[#0f3d2e]' },
    em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    concluido: { label: 'Concluído', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  };

  const config = statusConfig[status];
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${config.color} ${sizeClass}`}>
      {config.label}
    </span>
  );
}
