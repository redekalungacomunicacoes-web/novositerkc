import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BellRing,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileStack,
  FileUp,
  LogOut,
  MessageSquare,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { getCurrentEquipeMember } from "./tasksApi";
import { taskKeys, useCurrentMemberQuery, useNotificationsQuery } from "./useTaskQueries";
import type { TeamNotification } from "./types";

type TaskTab = {
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
};

const tabs: TaskTab[] = [
  { label: "Calendário", icon: CalendarDays, to: "/admin/tarefas", end: true },
  { label: "Kanban", icon: CheckSquare, to: "/admin/tarefas/kanban" },
  { label: "Anexos", icon: FileStack, to: "/admin/tarefas/anexos" },
  { label: "Equipe", icon: Users, to: "/admin/tarefas/equipe" },
  { label: "Relatórios", icon: BarChart3, to: "/admin/tarefas/relatorios" },
  { label: "Configurações", icon: Settings, to: "/admin/tarefas/configuracoes" },
];

function getInitials(name?: string | null) {
  const parts = (name || "Usuário").trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "U"}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

function notificationIcon(type: TeamNotification["type"]) {
  if (type === "comment") return MessageSquare;
  if (type === "attachment") return FileUp;
  if (type === "meeting") return CalendarClock;
  return BellRing;
}

function formatNotificationDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function NotificationsMenu() {
  const queryClient = useQueryClient();
  const notifications = useNotificationsQuery();
  const [open, setOpen] = useState(false);
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => new Set());
  const items = notifications.data ?? [];
  const unreadItems = items.filter((item) => item.status === "novo" && !viewedIds.has(item.id));

  function toggleNotifications() {
    setOpen((current) => {
      const next = !current;
      if (next) {
        setViewedIds((previous) => new Set([...previous, ...items.map((item) => item.id)]));
        void queryClient.invalidateQueries({ queryKey: taskKeys.notifications });
      }
      return next;
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleNotifications}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/70 dark:text-emerald-100 dark:hover:bg-emerald-900/70"
        aria-label="Abrir notificações"
      >
        <Bell size={18} />
        {unreadItems.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-rose-950/30">
            {unreadItems.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-14 z-40 w-[min(92vw,380px)] overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/15 dark:border-emerald-800/60 dark:bg-emerald-950 dark:shadow-black/40">
          <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-4 dark:border-emerald-800/60 dark:bg-emerald-900/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">Central de notificações</h3>
                <p className="text-xs text-slate-500 dark:text-emerald-100/70">Tarefas, comentários, atualizações e anexos</p>
              </div>
              <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">{unreadItems.length} novas</span>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {items.length ? items.map((item) => {
              const Icon = notificationIcon(item.type);
              const isNew = item.status === "novo" && !viewedIds.has(item.id);
              return (
                <article key={item.id} className="flex gap-3 rounded-2xl p-3 text-sm transition hover:bg-emerald-50 dark:hover:bg-emerald-900/50">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-100">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="font-medium text-slate-800 dark:text-emerald-50">{item.message}</p>
                      {isNew ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" /> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-emerald-100/60">{formatNotificationDate(item.date)}</p>
                  </div>
                </article>
              );
            }) : <p className="p-5 text-sm text-slate-500 dark:text-emerald-100/70">Nenhuma notificação no momento.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserMenu() {
  const currentMember = useCurrentMemberQuery();
  const [open, setOpen] = useState(false);
  const member = currentMember.data;
  const displayName = member?.nome || member?.email_login || "Usuário autenticado";
  const role = member?.cargo || "Equipe Rede Kalunga";
  const avatar = member?.foto_url || "/avatar-placeholder.svg";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-3xl border border-emerald-100 bg-white py-1.5 pl-1.5 pr-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/70"
      >
        <img src={avatar} alt={displayName} className="h-10 w-10 rounded-2xl object-cover" />
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-40 truncate text-sm font-semibold text-slate-900 dark:text-white">{displayName}</span>
          <span className="block max-w-40 truncate text-xs text-slate-500 dark:text-emerald-100/70">{role}</span>
        </span>
        <ChevronDown size={16} className="text-emerald-700 dark:text-emerald-200" />
      </button>
      {open ? (
        <div className="absolute right-0 top-14 z-40 w-64 rounded-3xl border border-emerald-100 bg-white p-2 shadow-2xl shadow-emerald-950/15 dark:border-emerald-800/60 dark:bg-emerald-950">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-900/60">
            <img src={avatar} alt={displayName} className="h-11 w-11 rounded-2xl object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-emerald-100/70">{role}</p>
            </div>
          </div>
          <button type="button" className="mt-2 flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50">
            <UserCircle size={16} /> Perfil
          </button>
          <button type="button" onClick={() => void supabase.auth.signOut()} className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950/40">
            <LogOut size={16} /> Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TasksTopBar() {
  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-emerald-100/80 bg-white/90 px-4 py-4 backdrop-blur-xl dark:border-emerald-900/70 dark:bg-emerald-950/90 md:-mx-6 md:px-6">
      <div className="mx-auto flex max-w-[1920px] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">Rede Kalunga Comunicações</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white md:text-3xl">Tarefas e Projetos</h1>
            <p className="text-sm text-slate-500 dark:text-emerald-100/70">Gestão Operacional</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsMenu />
            <UserMenu />
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto rounded-3xl border border-emerald-100 bg-emerald-50/60 p-1 dark:border-emerald-800/60 dark:bg-emerald-900/40">
          {tabs.map(({ label, icon: Icon, to, end }) => (
            <NavLink key={to} to={to} end={end} className="relative shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-emerald-800 dark:text-emerald-100/70 dark:hover:text-white">
              {({ isActive }) => (
                <span className="relative z-10 flex items-center gap-2">
                  {isActive ? <motion.span layoutId="tasks-active-tab" className="absolute inset-0 -z-10 rounded-2xl bg-white shadow-sm dark:bg-emerald-800" transition={{ type: "spring", stiffness: 420, damping: 32 }} /> : null}
                  <Icon size={16} className={isActive ? "text-emerald-700 dark:text-emerald-100" : "text-emerald-600/70 dark:text-emerald-200/60"} />
                  <span className={isActive ? "text-emerald-950 dark:text-white" : ""}>{label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function TasksPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#05241f] dark:text-emerald-50">
      <TasksTopBar />
      <main className="mx-auto max-w-[1920px] px-4 py-5 md:px-6">{children}</main>
    </div>
  );
}

export { getCurrentEquipeMember };
