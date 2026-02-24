interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
}

export function KPICard({ title, value, subtitle }: KPICardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
