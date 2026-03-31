export const taskBrandTheme = {
  brandPrimary: "#0F7A3E",
  brandPrimaryHover: "#0C6433",
  brandSoft: "#EAF6EF",
  brandBorder: "#9BCFB1",
  brandText: "#0D3A20",
  brandBadge: "#146C43",
  calendarTaskDay: "#F0F9F4",
  calendarSelectedDay: "#DDF2E5",
} as const;

export const priorityBadgeClass: Record<string, string> = {
  baixa: "border-slate-300 bg-slate-100 text-slate-700",
  media: "border-emerald-200 bg-emerald-100 text-emerald-800",
  alta: "border-amber-200 bg-amber-100 text-amber-800",
  urgente: "border-rose-200 bg-rose-100 text-rose-800",
};

export const statusBadgeClass: Record<string, string> = {
  pendente: "border-zinc-300 bg-zinc-100 text-zinc-800",
  em_andamento: "border-sky-200 bg-sky-100 text-sky-800",
  concluida: "border-emerald-200 bg-emerald-100 text-emerald-800",
  cancelada: "border-rose-200 bg-rose-100 text-rose-800",
};
