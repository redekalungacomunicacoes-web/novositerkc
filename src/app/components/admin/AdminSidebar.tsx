import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, FolderOpen, LogOut, Settings, Users, Mail, Info } from "lucide-react";
import { supabase } from "@/lib/supabase";

import logoRKC from "../../../assets/4eeb42365666e2aad88f332a0930461cd4eefe17.png";

type RoleName = "admin_alfa" | "admin" | "editor" | "autor";

type LinkItem = {
  href: string;
  label: string;
  icon: any;
  allow: RoleName[]; // roles que podem ver
};

async function loadMyRoles(): Promise<RoleName[]> {
  const { data: sessionRes } = await supabase.auth.getSession();
  const session = sessionRes.session;
  if (!session) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", session.user.id);

  if (error) return [];
  return (data || [])
    .map((r: any) => r?.role?.name)
    .filter(Boolean) as RoleName[];
}

function canSee(userRoles: RoleName[], allow: RoleName[]) {
  if (userRoles.includes("admin_alfa")) return true; // super
  return allow.some((r) => userRoles.includes(r));
}

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const [roles, setRoles] = useState<RoleName[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const links: LinkItem[] = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
      allow: ["admin_alfa", "admin", "editor", "autor"],
    },

    {
      href: "/admin/materias",
      label: "Matérias",
      icon: FileText,
      allow: ["admin_alfa", "admin", "editor", "autor"],
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
      icon: Users,
      allow: ["admin_alfa", "admin", "editor"],
    },

    {
      href: "/admin/newsletter",
      label: "Newsletter",
      icon: Mail,
      allow: ["admin_alfa", "admin", "editor"],
    },

    // RBAC/usuários só super
    { href: "/admin/usuarios", label: "Usuários", icon: Users, allow: ["admin_alfa"] },

    // ✅ NOVO: Quem Somos
    {
      href: "/admin/quemsomos",
      label: "Quem Somos",
      icon: Info,
      allow: ["admin_alfa"],
    },

    // Config só super
    { href: "/admin/configuracoes", label: "Configurações", icon: Settings, allow: ["admin_alfa"] },
  ];

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoadingRoles(true);
      const r = await loadMyRoles();
      if (!mounted) return;
      setRoles(r);
      setLoadingRoles(false);
    })();

    // Atualiza roles se o auth mudar
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const r = await loadMyRoles();
      if (!mounted) return;
      setRoles(r);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const visibleLinks = useMemo(() => {
    return links.filter((l) => canSee(roles, l.allow));
  }, [roles]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

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
              key={link.href}
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
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
