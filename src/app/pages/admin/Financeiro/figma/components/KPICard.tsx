import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;

  subtitle?: string;

  trend?: {
    value: string;
    positive: boolean;
  };

  variant?: "default" | "success" | "warning" | "danger" | "primary";
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  variant = "default",
}: KPICardProps) {
  const variantStyles = {
    default: "bg-white border-gray-200",
    primary: "bg-white border-[#0f3d2e]",
    success: "bg-white border-green-200",
    warning: "bg-white border-yellow-200",
    danger: "bg-white border-red-200",
  };

  const iconStyles = {
    default: "text-gray-600",
    primary: "text-[#0f3d2e]",
    success: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-red-600",
  };

  return (
    <div
      className={`rounded-xl border-2 p-6 shadow-sm transition-all hover:shadow-md ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>

          <p className="text-2xl font-semibold text-gray-900 mb-2">
            {value}
          </p>

          {subtitle && (
            <p className="text-xs text-gray-500 mb-2">{subtitle}</p>
          )}

          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={`text-sm font-medium ${
                  trend.positive ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.positive ? "↑" : "↓"} {trend.value}
              </span>
              <span className="text-xs text-gray-500">
                vs mês anterior
              </span>
            </div>
          )}
        </div>

        <div
          className={`p-3 rounded-lg bg-gray-50 ${iconStyles[variant]}`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
