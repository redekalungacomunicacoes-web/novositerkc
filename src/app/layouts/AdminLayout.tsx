import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminSidebar, useVisibleAdminLinks } from "@/app/components/admin/AdminSidebar";
import { LogOut, Menu, Share2, X } from "lucide-react";
import { getCurrentUserRoles } from "@/lib/rbac";
import { getAppSettings } from "@/lib/appSettings";
import { supabase } from "@/lib/supabase";

type AppBrand = { name: string; shortName: string; logoUrl: string | null; shareEnabled: boolean; shareTitle: string; shareText: string };

export function AdminLayout() {
  const location = useLocation();
  const isTaskArea = location.pathname.startsWith("/admin/tarefas");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [brand, setBrand] = useState<AppBrand>({
    name: "Rede Kalunga Comunicações",
    shortName: "RKC",
    logoUrl: null,
    shareEnabled: true,
    shareTitle: "Rede Kalunga Comunicações",
    shareText: "Acompanhe as notícias, a cultura e as histórias do Território Kalunga.",
  });

  useEffect(() => {
    let active = true;
    getAppSettings().then((settings) => {
      if (!active) return;
      setBrand({
        name: settings.app_name,
        shortName: settings.app_short_name,
        logoUrl: settings.app_logo_url,
        shareEnabled: settings.app_share_enabled,
        shareTitle: settings.app_share_title,
        shareText: settings.app_share_text,
      });
    }).catch(() => {
      // Keep the defaults when the settings table is temporarily unavailable.
    });
    return () => { active = false; };
  }, []);

  async function handleShareApp() {
    try {
      const data = { title: brand.shareTitle || brand.name, text: brand.shareText, url: `${window.location.origin}/` };
      if (navigator.share) {
        await navigator.share(data);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText([data.title, data.text, data.url].join("\\n"));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error("Não foi possível compartilhar o app:", error);
    }
  }

  return (
    <div className="min-h-dvh bg-muted/20 font-sans">
      <AdminSidebar />

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 shadow-sm backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-xl object-contain" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-800 text-xs font-bold text-white">RKC</span>
          )}
          <span className="truncate text-sm font-semibold">{brand.shortName || brand.name}</span>
        </div>
        <div className="flex items-center gap-1">
        {brand.shareEnabled && <button type="button" onClick={() => void handleShareApp()} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted" aria-label="Compartilhar aplicativo"><Share2 className="h-5 w-5" /></button>}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted"
          aria-label="Abrir menu do painel"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background md:hidden">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <h2 className="font-semibold">Menu do painel</h2>
            <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-muted" aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-4">
            <AdminSidebarMobile onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="min-h-[calc(100dvh-3.5rem)] min-w-0 overflow-x-hidden pb-24 transition-all duration-300 ease-in-out md:min-h-screen md:pb-0 md:pl-64">
        <div className={isTaskArea ? "mx-auto max-w-[1920px] p-3 sm:p-4 md:p-6" : "container mx-auto max-w-7xl p-3 sm:p-4 md:p-8"}>
          <Outlet />
        </div>
      </main>

      <AdminBottomNavigation onMore={() => setIsMobileMenuOpen(true)} onNavigate={() => setIsMobileMenuOpen(false)} />
    </div>
  );
}

function AdminBottomNavigation({ onMore, onNavigate }: { onMore: () => void; onNavigate: () => void }) {
  const location = useLocation();
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    getCurrentUserRoles().then(({ roles: userRoles }) => {
      if (active) setRoles(userRoles);
    });
    return () => { active = false; };
  }, []);

  const links = useVisibleAdminLinks(roles);
  const preferred = ["/admin", "/admin/materias", "/admin/editais"];
  const primaryLinks = preferred.flatMap((href) => {
    const link = links.find((item) => item.href === href);
    return link ? [link] : [];
  });

  return (
    <nav
      aria-label="Navegação principal do painel"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {primaryLinks.map((link) => {
          const Icon = link.icon;
          const active = location.pathname === link.href || (link.href !== "/admin" && location.pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              to={link.href}
              onClick={onNavigate}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${active ? "text-green-800" : "text-muted-foreground"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{link.href === "/admin" ? "Início" : link.href === "/admin/editais" ? "Editais" : link.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-muted-foreground hover:text-green-800" aria-label="Abrir todos os módulos">
          <Menu className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </div>
    </nav>
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
    return () => { mounted = false; };
  }, []);

  const links = useVisibleAdminLinks(roles);

  async function handleLogout() {
    await supabase.auth.signOut();
    onClose();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col">
      <nav className="flex-1 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              to={link.href}
              onClick={onClose}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors ${isActive ? "bg-green-50 text-green-800" : "text-muted-foreground hover:bg-muted"}`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 border-t pt-4">
        <button
          onClick={() => { void handleLogout(); }}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </div>
  );
}
