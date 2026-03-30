import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FolderOpen,
  LayoutDashboard,
  FileText,
  Users,
  Users2,
  Mail,
  Info,
  Settings,
  LogOut,
  Landmark,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import logoRKC from "@/assets/4eeb42365666e2aad88f332a0930461cd4eefe17.png";
import { getCurrentUserRoles } from "@/lib/rbac";

type RoleName =
  | "admin_alfa"
  | "admin"
  | "editor"
  | "autor"
  | "financeiro";

type SidebarLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  allow: RoleName[];
};

export const adminLinks: SidebarLink[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    allow: ["admin_alfa", "admin", "editor", "autor", "financeiro"],
  },
  {
    href: "/admin/materias",
    label: "Matérias",
    icon: FileText,
    allow: ["admin_alfa", "admin", "editor", "autor"],
  },
  {
    href: "/admin/perfil",
    label: "Perfil",
    icon: Users,
    allow: ["autor"],
  },
  {
    href: "/admin/projetos",
    label: "Projetos",
    icon: FolderOpen,
    allow: ["admin_alfa", "admin", "editor"],
  },
  {
    href: "/admin/equipe",
    label: "Equipe",
    icon: Users2,
    allow: ["admin_alfa", "admin", "editor"],
  },
  {
    href: "/admin/quem-somos",
    label: "Quem Somos",
    icon: Info,
    allow: ["admin_alfa", "admin", "editor"],
  },
  {
    href: "/admin/newsletter",
    label: "Newsletter",
    icon: Mail,
    allow: ["admin_alfa", "admin", "editor"],
  },
  {
    href: "/admin/financeiro",
    label: "Financeiro",
    icon: Landmark,
    allow: ["admin_alfa", "admin", "financeiro"],
  },
  {
    href: "/admin/usuarios",
    label: "Usuários",
    icon: Users,
    allow: ["admin_alfa"],
  },
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    icon: Settings,
    allow: ["admin_alfa"],
  },
];

function normalizeRoles(roles: string[]): RoleName[] {
  const allowed: RoleName[] = [
    "admin_alfa",
    "admin",
    "editor",
    "autor",
    "financeiro",
  ];

  return [...new Set(roles)]
    .map((role) => role.trim().toLowerCase())
    .filter((role): role is RoleName =>
      allowed.includes(role as RoleName)
    );
}

function filterLinksByRoles(userRoles: string[]) {
  const roles = normalizeRoles(userRoles);

  if (!roles.length) return [];
  if (roles.includes("admin_alfa")) return adminLinks;

  return adminLinks.filter((link) =>
    link.allow.some((role) => roles.includes(role))
  );
}

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRoles() {
      setLoadingRoles(true);

      const { roles: fetchedRoles } = await getCurrentUserRoles();
      if (!mounted) return;

      setRoles(normalizeRoles(fetchedRoles));
      setLoadingRoles(false);
    }

    void loadRoles();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadRoles();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const visibleLinks = useMemo(() => filterLinksByRoles(roles), [roles]);
  const pathname = location.pathname;

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
        <img
          src={logoRKC}
          alt="Rede Kalunga Comunicações"
          className="h-12 w-auto"
        />
      </div>

      <div className="px-6 py-3 border-b border-sidebar-border text-xs text-muted-foreground">
        {loadingRoles ? (
          <span>Carregando permissões...</span>
        ) : (
          <span>
            Permissões: {roles.length ? roles.join(", ") : "—"}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== "/admin" && pathname.startsWith(link.href));

          return (
            <Link
              key={`${link.href}-${link.label}`}
              to={link.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium border-l-4 transition-colors ${
                isActive
                  ? "bg-green-50 border-green-600 text-green-700"
                  : "border-transparent text-gray-600 hover:bg-green-50 hover:text-green-700"
              }`}
            >
              <Icon className="h-4 w-4 text-current" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={() => {
            void handleLogout();
          }}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut className="h-4 w-4 text-current" />
          Sair
        </button>
      </div>
    </aside>
  );
}

export function useVisibleAdminLinks(userRoles: string[]) {
  return filterLinksByRoles(userRoles);
}
