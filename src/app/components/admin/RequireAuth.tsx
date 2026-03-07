import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRoles, hasAdminPanelRole } from "@/lib/rbac";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      setLoading(true);

      const { data, error } = await supabase.auth.getSession();
      const session = data.session;

      if (!mounted) return;

      if (error || !session) {
        setOk(false);
        setLoading(false);
        return;
      }

      const rolesRes = await getCurrentUserRoles();
      if (!mounted) return;

      if (rolesRes.error) {
        setOk(false);
        setLoading(false);
        return;
      }

      setOk(hasAdminPanelRole(rolesRes.roles));
      setLoading(false);
    }

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Validando autenticação...</div>;
  }

  if (!ok) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}
