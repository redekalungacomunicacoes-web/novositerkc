import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Users, Users2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DashboardCounts = {
  materias: number | null;
  projetos: number | null;
  equipe: number | null;
  newsletter: number | null;
  usuarios: number | null;
};

const EMPTY_COUNTS: DashboardCounts = {
  materias: null,
  projetos: null,
  equipe: null,
  newsletter: null,
  usuarios: null,
};

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function Dashboard() {
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadCounts() {
      setLoadingCounts(true);

      const { data, error } = await supabase.rpc("admin_dashboard_counts");
      if (error) {
        console.warn("[admin_dashboard_counts] Falha ao carregar indicadores:", error.message);
        if (mounted) {
          setCounts(EMPTY_COUNTS);
          setLoadingCounts(false);
        }
        return;
      }

      const raw = (data ?? {}) as Record<string, unknown>;
      const nextCounts: DashboardCounts = {
        materias: toNullableNumber(raw.materias),
        projetos: toNullableNumber(raw.projetos),
        equipe: toNullableNumber(raw.equipe),
        newsletter: toNullableNumber(raw.newsletter),
        usuarios: toNullableNumber(raw.usuarios),
      };

      if (mounted) {
        setCounts(nextCounts);
        setLoadingCounts(false);
      }
    }

    loadCounts();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      { title: "Matérias", value: counts.materias, icon: FileText },
      { title: "Projetos", value: counts.projetos, icon: FolderOpen },
      { title: "Integrantes (Equipe)", value: counts.equipe, icon: Users2 },
      { title: "Usuários", value: counts.usuarios, icon: Users },
      { title: "Cadastrados na Newsletter", value: counts.newsletter, icon: Mail },
    ],
    [counts],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Bem-vindo ao painel administrativo da Rede Kalunga Comunicações.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.title} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{stat.title}</h3>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="pt-2">
              {loadingCounts ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse" aria-label="Carregando indicador" />
              ) : (
                <div className="text-2xl font-bold">{stat.value ?? "—"}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Indicador em tempo real</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
