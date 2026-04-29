export const taskBrandTheme = {
  brandPrimary: "#0F7A3E",
} as const;

export const priorityBadgeClass: Record<string, string> = {
  urgente: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#B91C1C]",
  alta: "border-[#F97316]/30 bg-[#F97316]/10 text-[#C2410C]",
  media: "border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#1D4ED8]",
  baixa: "border-[#EAB308]/30 bg-[#EAB308]/10 text-[#A16207]",
  concluida: "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#15803D]",
};

export const statusBadgeClass: Record<string, string> = {
  pendente: "border-zinc-300 bg-zinc-100 text-zinc-800",
  em_andamento: "border-sky-200 bg-sky-100 text-sky-800",
  concluida: "border-emerald-200 bg-emerald-100 text-emerald-800",
  cancelada: "border-rose-200 bg-rose-100 text-rose-800",
};
