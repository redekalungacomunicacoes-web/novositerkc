import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/app/components/admin/AdminSidebar";
import { Menu } from "lucide-react";
import { useState } from "react";

export function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-sans">
      <AdminSidebar />

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-sidebar text-sidebar-foreground">
        <span className="font-bold text-lg">RKC Admin</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Menu (Simple overlay for now) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background md:hidden p-4">
          <div className="flex justify-end">
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2">
              ✕
            </button>
          </div>
          <div className="mt-8">
            <AdminSidebarMobile onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="md:pl-64 min-h-screen transition-all duration-300 ease-in-out">
        <div className="container mx-auto p-6 md:p-8 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Temporary internal component for mobile sidebar reuse
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, FolderOpen, LogOut, Settings, Users, Users2, Mail, Info } from "lucide-react";

function AdminSidebarMobile({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const pathname = location.pathname;

  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/materias", label: "Matérias", icon: FileText },
    { href: "/admin/projetos", label: "Projetos", icon: FolderOpen },
    { href: "/admin/equipe", label: "Equipe", icon: Users2 },
    { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
    { href: "/admin/usuarios", label: "Usuários", icon: Users },
    // ✅ NOVO: Quem Somos
    { href: "/admin/quemsomos", label: "Quem Somos", icon: Info },
    { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              to={link.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 pt-8 border-t">
        <button className="flex w-full items-center gap-3 px-3 py-3 rounded-md text-base font-medium text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </div>
  );
}
