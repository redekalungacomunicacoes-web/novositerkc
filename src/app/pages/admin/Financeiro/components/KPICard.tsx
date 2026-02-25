import { TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'success';
  icon?: React.ReactNode;
}

export function KPICard({ title, value, trend, variant = 'default', icon }: KPICardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    primary: 'bg-white border-[#0f3d2e] border-2',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-white border-gray-200',
  };

  return (
    <div className={`rounded-xl border p-6 ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-gray-600">{title}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <p className="text-2xl font-semibold text-gray-900 mb-2">{value}</p>
      {trend && (
        <div className="flex items-center gap-1">
          {trend.isPositive ? (
            <TrendingUp className="w-4 h-4 text-green-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
