import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Users, Users2, Mail, Eye } from "lucide-react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { supabase } from "@/lib/supabase";

type DashboardCounts = {
  materias: number | null;
  projetos: number | null;
  equipe: number | null;
  newsletter: number | null;
  usuarios: number | null;
};

type DashboardAnalytics = {
  siteTotal: number | null;
  lastDaysTotal: number | null;
  daily: Array<{ day: string; total: number; site: number; materias: number; projetos: number }>;
  topMaterias: Array<{ id: string; titulo: string; slug: string; views: number }>;
  topProjetos: Array<{ id: string; titulo: string; slug: string; views: number }>;
};

const EMPTY_COUNTS: DashboardCounts = {
  materias: null,
  projetos: null,
  equipe: null,
  newsletter: null,
  usuarios: null,
};

const EMPTY_ANALYTICS: DashboardAnalytics = {
  siteTotal: null,
  lastDaysTotal: null,
  daily: [],
  topMaterias: [],
  topProjetos: [],
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
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(EMPTY_ANALYTICS);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

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

    async function loadAnalytics() {
      setLoadingAnalytics(true);

      const { data, error } = await supabase.rpc("admin_dashboard_analytics", { p_days: 14 });
      if (error) {
        console.warn("[admin_dashboard_analytics] Falha ao carregar analytics:", error.message);
        if (mounted) {
          setAnalytics(EMPTY_ANALYTICS);
          setLoadingAnalytics(false);
        }
        return;
      }

      const raw = (data ?? {}) as Record<string, any>;
      const nextAnalytics: DashboardAnalytics = {
        siteTotal: toNullableNumber(raw.site_total),
        lastDaysTotal: toNullableNumber(raw.last_days_total),
        daily: Array.isArray(raw.daily)
          ? raw.daily.map((item: any) => ({
              day: typeof item.day === "string" ? item.day.slice(5) : "",
              total: toNullableNumber(item.total) ?? 0,
              site: toNullableNumber(item.site) ?? 0,
              materias: toNullableNumber(item.materias) ?? 0,
              projetos: toNullableNumber(item.projetos) ?? 0,
            }))
          : [],
        topMaterias: Array.isArray(raw.top_materias)
          ? raw.top_materias.map((item: any) => ({
              id: item.id,
              titulo: item.titulo || "Sem título",
              slug: item.slug || "",
              views: toNullableNumber(item.views) ?? 0,
            }))
          : [],
        topProjetos: Array.isArray(raw.top_projetos)
          ? raw.top_projetos.map((item: any) => ({
              id: item.id,
              titulo: item.titulo || "Sem título",
              slug: item.slug || "",
              views: toNullableNumber(item.views) ?? 0,
            }))
          : [],
      };

      if (mounted) {
        setAnalytics(nextAnalytics);
        setLoadingAnalytics(false);
      }
    }

    loadCounts();
    loadAnalytics();

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
      { title: "Visualizações no site", value: analytics.siteTotal, icon: Eye },
    ],
    [analytics.siteTotal, counts],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Bem-vindo ao painel administrativo da Rede Kalunga Comunicações.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.title} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{stat.title}</h3>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="pt-2">
              {loadingCounts || (stat.title === "Visualizações no site" && loadingAnalytics) ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse" aria-label="Carregando indicador" />
              ) : (
                <div className="text-2xl font-bold">{stat.value ?? "—"}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Indicador em tempo real</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 lg:col-span-2">
          <h3 className="font-semibold">Visualizações por dia (últimos 14 dias)</h3>
          <p className="text-sm text-muted-foreground mt-1">Total no período: {loadingAnalytics ? "..." : analytics.lastDaysTotal ?? "—"}</p>

          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.daily} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#0F7A3E" strokeWidth={3} dot={false} name="Total" />
                <Line type="monotone" dataKey="materias" stroke="#2FA866" strokeWidth={2} dot={false} name="Matérias" />
                <Line type="monotone" dataKey="projetos" stroke="#EAB308" strokeWidth={2} dot={false} name="Projetos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Top matérias (14 dias)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {analytics.topMaterias.length === 0 && <li className="text-muted-foreground">Sem dados ainda.</li>}
            {analytics.topMaterias.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="line-clamp-1">{item.titulo}</span>
                <strong>{item.views}</strong>
              </li>
            ))}
          </ul>

          <h3 className="font-semibold mt-6">Top projetos (14 dias)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {analytics.topProjetos.length === 0 && <li className="text-muted-foreground">Sem dados ainda.</li>}
            {analytics.topProjetos.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="line-clamp-1">{item.titulo}</span>
                <strong>{item.views}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
