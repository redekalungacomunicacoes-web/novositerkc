import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { FINANCE_MODULE_ROLES, getCurrentUserRoles, hasAnyRole } from "@/lib/rbac";

export function RequireFinanceRole({ children }: { children: React.ReactNode }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { roles } = await getCurrentUserRoles();
      setRoles(roles);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return null;

  const allowed = hasAnyRole(roles, FINANCE_MODULE_ROLES);

  if (!allowed) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
