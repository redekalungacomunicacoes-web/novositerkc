import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FileStack,
  Moon,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";

import { supabase } from "@/lib/supabase";

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
};

const items: SidebarItem[] = [
  { label: "Calendário", icon: CalendarDays, to: "/admin/tarefas", end: true },
  { label: "Tarefas", icon: CheckSquare, to: "/admin/tarefas/kanban" },
  { label: "Anexos", icon: FileStack, to: "/admin/tarefas/anexos" },
  { label: "Equipe", icon: Users, to: "/admin/tarefas/equipe" },
  { label: "Relatórios", icon: BarChart3, to: "/admin/tarefas/relatorios" },
  { label: "Configurações", icon: Settings, to: "/admin/tarefas/configuracoes" },
];

function getDisplayName(email?: string | null, fullName?: unknown) {
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (email?.trim()) return email.trim();
  return "Usuário conectado";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";

  return `${first}${second}`.toUpperCase();
}

export function Sidebar() {
  const [displayName, setDisplayName] = useState("Usuário conectado");
  const [themePreview, setThemePreview] = useState<"dark" | "light">("dark");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      setDisplayName(
        getDisplayName(
          data.user?.email,
          data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name
        )
      );
    }

    void loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setDisplayName(
        getDisplayName(
          session?.user.email,
          session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name
        )
      );
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  return (
    <aside className="hidden w-72 flex-col rounded-3xl border border-white/10 bg-slate-900 p-4 text-slate-300 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:flex">
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-sky-400">
          Admin
        </p>
        <h1 className="mt-2 text-xl font-semibold text-white">Tarefas e Projetos</h1>
        <p className="mt-1 text-sm text-slate-400">Gestão operacional</p>
      </div>

      <nav className="space-y-2">
        {items.map(({ label, icon: Icon, to, end }) => (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }} key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-sky-500/30 bg-sky-500/20 text-white shadow-lg shadow-sky-950/20"
                    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={16}
                    className={isActive ? "text-sky-300" : "text-slate-400 group-hover:text-sky-300"}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </motion.div>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/15 text-sm font-semibold text-sky-200">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{displayName}</p>
            <p className="text-xs text-slate-400">Usuário autenticado</p>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={themePreview === "light"}
          onClick={() => setThemePreview((current) => (current === "dark" ? "light" : "dark"))}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <span>Dark/Light</span>
          <span className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900 p-1">
            <span
              className={`rounded-lg p-1 transition-colors ${
                themePreview === "dark" ? "bg-sky-500 text-white" : "text-slate-500"
              }`}
            >
              <Moon size={14} />
            </span>
            <span
              className={`rounded-lg p-1 transition-colors ${
                themePreview === "light" ? "bg-sky-500 text-white" : "text-slate-500"
              }`}
            >
              <Sun size={14} />
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
