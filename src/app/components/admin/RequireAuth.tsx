import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        if (mounted) {
          setOk(false);
          setLoading(false);
        }
        return;
      }

      const userId = session.user.id;

      const { data: rolesData, error } = await supabase
        .from("user_roles")
        .select("role:roles(name)")
        .eq("user_id", userId);

      if (!mounted) return;

      if (error) {
        setOk(false);
        setLoading(false);
        return;
      }

      const roleNames = (rolesData || [])
        .map((r: any) => r?.role?.name)
        .filter(Boolean);

      const allowed = roleNames.some((r: string) =>
        ["admin_alfa", "admin", "editor", "autor"].includes(r)
      );

      setOk(allowed);
      setLoading(false);
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;
  if (!ok) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}
