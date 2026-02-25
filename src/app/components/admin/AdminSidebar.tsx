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

type RoleName = "admin_alfa" | "admin" | "editor" | "autor";

type SidebarLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  allow: RoleName[];
};

type UserRoleRow = {
  role: {
    name: RoleName;
  } | null;
};

const links: SidebarLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, allow: ["admin_alfa", "admin", "editor", "autor"] },
  { href: "/admin/materias", label: "Matérias", icon: FileText, allow: ["admin_alfa", "admin", "editor", "autor"] },
  { href: "/admin/projetos", label: "Projetos", icon: FolderOpen, allow: ["admin_alfa", "admin", "editor"] },
  { href: "/admin/equipe", label: "Equipe", icon: Users2, allow: ["admin_alfa", "admin", "editor"] },
  { href: "/admin/quem-somos", label: "Quem Somos", icon: Info, allow: ["admin_alfa", "admin", "editor"] },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail, allow: ["admin_alfa", "admin", "editor"] },
  { href: "/admin/financeiro", label: "Financeiro", icon: Landmark, allow: ["admin_alfa", "admin", "editor"] },
  { href: "/admin/usuarios", label: "Usuários", icon: Users, allow: ["admin_alfa"] },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings, allow: ["admin_alfa"] },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRoles() {
      setLoadingRoles(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        if (mounted) {
          setRoles([]);
          setLoadingRoles(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role:roles(name)")
        .eq("user_id", session.user.id);

      if (!mounted) return;

      if (error) {
        setRoles([]);
        setLoadingRoles(false);
        return;
      }

      const userRoles = (data as UserRoleRow[] | null)
        ?.map((row) => row.role?.name)
        .filter((name): name is RoleName => Boolean(name)) ?? [];

      setRoles(userRoles);
      setLoadingRoles(false);
    }

    void loadRoles();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleLinks = useMemo(() => {
    if (!roles.length) return [];

    const filtered = roles.includes("admin_alfa")
      ? links
      : links.filter((link) => link.allow.some((role) => roles.includes(role)));

    const canViewTeam = roles.some((role) => ["admin_alfa", "admin", "editor"].includes(role));
    if (canViewTeam && !filtered.some((link) => link.href === "/admin/equipe")) {
      const teamLink = links.find((link) => link.href === "/admin/equipe");
      if (teamLink) return [...filtered, teamLink];
    }

    return filtered;
  }, [roles]);

  const pathname = location.pathname;

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
        <img src={logoRKC} alt="Rede Kalunga Comunicações" className="h-12 w-auto" />
      </div>

      <div className="px-6 py-3 border-b border-sidebar-border text-xs text-muted-foreground">
        {loadingRoles ? (
          <span>Carregando permissões...</span>
        ) : (
          <span>Permissões: {roles.length ? roles.join(", ") : "—"}</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));

          return (
            <Link
              key={`${link.href}-${link.label}`}
              to={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
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
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
