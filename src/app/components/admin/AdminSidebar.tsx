return (
  <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col h-screen fixed left-0 top-0 z-40">
    <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
      <img src={logoRKC} alt="Rede Kalunga Comunicações" className="h-12 w-auto" />
    </div>

    {/* ✅ Assinatura pra garantir que este arquivo está sendo o usado */}
    <div className="px-6 py-2 text-[10px] text-muted-foreground border-b border-sidebar-border">
      SIDEBAR DESKTOP VERSAO: 2026-02-25 (com Equipe)
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
        const isActive =
          pathname === link.href ||
          (link.href !== "/admin" && pathname.startsWith(link.href));

        return (
          <Link
            key={`${link.href}-${link.label}`}  // ✅ blindado
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
