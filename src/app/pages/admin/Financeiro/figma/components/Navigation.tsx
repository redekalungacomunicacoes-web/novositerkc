import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Wallet } from 'lucide-react';

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/financeiro/projetos', label: 'Projetos', icon: FolderKanban },
    { path: '/admin/financeiro/fundos', label: 'Fundos', icon: Wallet },
  ];

  return (
    <nav className="bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20] border-b border-[#0f3d2e]/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Financeiro</h1>
                <p className="text-xs text-white/60">Gestão Administrativa</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white/10 rounded-lg border border-white/20">
              <p className="text-xs text-white/60">Saldo Total</p>
              <p className="text-base font-semibold text-white">R$ 66.630,00</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
