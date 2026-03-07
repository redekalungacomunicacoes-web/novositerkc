import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUserRoles } from "@/lib/rbac";

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

  const allowed =
    roles.includes("admin_alfa") ||
    roles.includes("admin") ||
    roles.includes("financeiro");

  if (!allowed) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
