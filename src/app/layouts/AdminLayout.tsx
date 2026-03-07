import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AdminSidebar, useVisibleAdminLinks } from "@/app/components/admin/AdminSidebar";

import { Menu, LogOut } from "lucide-react";
import { getCurrentUserRoles } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";

export function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-sans">
      <AdminSidebar />

      <div className="md:hidden flex items-center justify-between p-4 border-b bg-sidebar text-sidebar-foreground">
        <span className="font-bold text-lg">RKC Admin</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
          <Menu className="h-6 w-6" />
        </button>
      </div>

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

function AdminSidebarMobile({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadRoles() {
      const { roles: userRoles } = await getCurrentUserRoles();
      if (mounted) setRoles(userRoles);
    }

    void loadRoles();

    return () => {
      mounted = false;
    };
  }, []);

  const links = useMemo(() => useVisibleAdminLinks(roles), [roles]);

  async function handleLogout() {
    await supabase.auth.signOut();
    onClose();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));

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
        <button
          onClick={() => {
            void handleLogout();
          }}
          className="flex w-full items-center gap-3 px-3 py-3 rounded-md text-base font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </div>
  );
}
