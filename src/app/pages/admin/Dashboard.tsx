import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Users, Users2, Mail, Eye } from "lucide-react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRoles } from "@/lib/rbac";

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

type CountKey = keyof DashboardCounts;
type CountBlockState = Record<CountKey, "ok" | "forbidden" | "error">;
type AnalyticsBlockState = {
  siteViews: "ok" | "forbidden" | "error";
  lineChart: "ok" | "forbidden" | "error";
  topMaterias: "ok" | "forbidden" | "error";
  topProjetos: "ok" | "forbidden" | "error";
};

type UserRole = "admin_alfa" | "admin" | "editor" | "autor" | "financeiro";

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

const INITIAL_COUNT_STATE: CountBlockState = {
  materias: "ok",
  projetos: "ok",
  equipe: "ok",
  newsletter: "ok",
  usuarios: "ok",
};

const INITIAL_ANALYTICS_STATE: AnalyticsBlockState = {
  siteViews: "ok",
  lineChart: "ok",
  topMaterias: "ok",
  topProjetos: "ok",
};

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeRoles(roles: string[]): UserRole[] {
  const allowed: UserRole[] = ["admin_alfa", "admin", "editor", "autor", "financeiro"];
  return [...new Set(roles)]
    .map((role) => role.trim().toLowerCase())
    .filter((role): role is UserRole => allowed.includes(role as UserRole));
}

function isForbiddenError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42501" || candidate.code === "PGRST301" || (candidate.message || "").toLowerCase().includes("acesso negado");
}

export function Dashboard() {
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(EMPTY_ANALYTICS);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [countState, setCountState] = useState<CountBlockState>(INITIAL_COUNT_STATE);
  const [analyticsState, setAnalyticsState] = useState<AnalyticsBlockState>(INITIAL_ANALYTICS_STATE);


  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoadingCounts(true);
      setLoadingAnalytics(true);
      setCountState(INITIAL_COUNT_STATE);
      setAnalyticsState(INITIAL_ANALYTICS_STATE);

      const { roles: fetchedRoles } = await getCurrentUserRoles();
      const normalizedRoles = normalizeRoles(fetchedRoles);
      if (!mounted) return;

      const autorOnly = normalizedRoles.includes("autor") && !normalizedRoles.includes("admin") && !normalizedRoles.includes("admin_alfa") && !normalizedRoles.includes("editor");

      const countRequests: Array<Promise<{ key: CountKey; value: number | null }>> = [
        supabase.from("materias").select("id", { count: "exact", head: true }).then(({ count, error }) => {
          if (error) throw error;
          return { key: "materias" as CountKey, value: count ?? 0 };
        }),
        supabase.from("projetos").select("id", { count: "exact", head: true }).then(({ count, error }) => {
          if (error) throw error;
          return { key: "projetos" as CountKey, value: count ?? 0 };
        }),
        supabase.from("equipe").select("id", { count: "exact", head: true }).then(({ count, error }) => {
          if (error) throw error;
          return { key: "equipe" as CountKey, value: count ?? 0 };
        }),
        supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).then(({ count, error }) => {
          if (error) throw error;
          return { key: "newsletter" as CountKey, value: count ?? 0 };
        }),
      ];

      if (!autorOnly) {
        countRequests.push(
          supabase.from("user_roles").select("user_id", { count: "exact", head: true }).then(({ count, error }) => {
            if (error) throw error;
            return { key: "usuarios" as CountKey, value: count ?? 0 };
          }),
        );
      }

      const countResults = await Promise.allSettled(countRequests);
      const countKeys: CountKey[] = autorOnly
        ? ["materias", "projetos", "equipe", "newsletter"]
        : ["materias", "projetos", "equipe", "newsletter", "usuarios"];
      if (!mounted) return;

      const nextCounts: DashboardCounts = { ...EMPTY_COUNTS };
      const nextCountState: CountBlockState = { ...INITIAL_COUNT_STATE };
      countResults.forEach((result, index) => {
        const key = countKeys[index];
        if (!key) return;

        if (result.status === "fulfilled") {
          nextCounts[key] = result.value.value;
          return;
        }

        nextCountState[key] = isForbiddenError(result.reason) ? "forbidden" : "error";
      });

      if (autorOnly) {
        nextCountState.usuarios = "forbidden";
      }

      setCounts(nextCounts);
      setCountState(nextCountState);
      setLoadingCounts(false);

      const { data, error } = await supabase.rpc("admin_dashboard_analytics", { p_days: 14 });
      if (!mounted) return;

      if (error) {
        const forbidden = isForbiddenError(error);
        setAnalyticsState({
          siteViews: forbidden ? "forbidden" : "error",
          lineChart: forbidden ? "forbidden" : "error",
          topMaterias: forbidden ? "forbidden" : "error",
          topProjetos: forbidden ? "forbidden" : "error",
        });

        if (forbidden) {
          const [siteViewsRes, topMateriasRes, topProjetosRes] = await Promise.allSettled([
            supabase.from("page_views").select("id", { count: "exact", head: true }).eq("page_type", "site"),
            supabase
              .from("page_views")
              .select("content_id, content_slug, materias!inner(id, titulo, slug)")
              .eq("page_type", "materia")
              .not("content_id", "is", null)
              .limit(1000),
            supabase
              .from("page_views")
              .select("content_id, content_slug, projetos!inner(id, titulo, slug)")
              .eq("page_type", "projeto")
              .not("content_id", "is", null)
              .limit(1000),
          ]);

          const fallbackAnalytics: DashboardAnalytics = { ...EMPTY_ANALYTICS };
          const fallbackState: AnalyticsBlockState = {
            siteViews: "forbidden",
            lineChart: "forbidden",
            topMaterias: "forbidden",
            topProjetos: "forbidden",
          };

          if (siteViewsRes.status === "fulfilled" && !siteViewsRes.value.error) {
            fallbackAnalytics.siteTotal = siteViewsRes.value.count ?? 0;
            fallbackState.siteViews = "ok";
          }

          if (topMateriasRes.status === "fulfilled" && !topMateriasRes.value.error) {
            const grouped = new Map<string, { id: string; titulo: string; slug: string; views: number }>();
            for (const item of topMateriasRes.value.data || []) {
              const m = Array.isArray((item as any).materias) ? (item as any).materias[0] : (item as any).materias;
              if (!m?.id) continue;
              const key = String(m.id);
              const prev = grouped.get(key);
              grouped.set(key, {
                id: key,
                titulo: m.titulo || "Sem título",
                slug: m.slug || "",
                views: (prev?.views || 0) + 1,
              });
            }
            fallbackAnalytics.topMaterias = [...grouped.values()].sort((a, b) => b.views - a.views).slice(0, 5);
            fallbackState.topMaterias = "ok";
          }

          if (topProjetosRes.status === "fulfilled" && !topProjetosRes.value.error) {
            const grouped = new Map<string, { id: string; titulo: string; slug: string; views: number }>();
            for (const item of topProjetosRes.value.data || []) {
              const p = Array.isArray((item as any).projetos) ? (item as any).projetos[0] : (item as any).projetos;
              if (!p?.id) continue;
              const key = String(p.id);
              const prev = grouped.get(key);
              grouped.set(key, {
                id: key,
                titulo: p.titulo || "Sem título",
                slug: p.slug || "",
                views: (prev?.views || 0) + 1,
              });
            }
            fallbackAnalytics.topProjetos = [...grouped.values()].sort((a, b) => b.views - a.views).slice(0, 5);
            fallbackState.topProjetos = "ok";
          }

          setAnalytics(fallbackAnalytics);
          setAnalyticsState(fallbackState);
        } else {
          console.warn("[dashboard] Falha ao carregar analytics:", error.message);
          setAnalytics(EMPTY_ANALYTICS);
        }

        setLoadingAnalytics(false);
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

      setAnalytics(nextAnalytics);
      setLoadingAnalytics(false);
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      { title: "Matérias", value: counts.materias, icon: FileText, state: countState.materias },
      { title: "Projetos", value: counts.projetos, icon: FolderOpen, state: countState.projetos },
      { title: "Integrantes (Equipe)", value: counts.equipe, icon: Users2, state: countState.equipe },
      { title: "Usuários", value: counts.usuarios, icon: Users, state: countState.usuarios },
      { title: "Cadastrados na Newsletter", value: counts.newsletter, icon: Mail, state: countState.newsletter },
      { title: "Visualizações no site", value: analytics.siteTotal, icon: Eye, state: analyticsState.siteViews },
    ],
    [analytics.siteTotal, analyticsState.siteViews, countState, counts],
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
              ) : stat.state === "forbidden" ? (
                <div className="text-sm text-muted-foreground">Sem permissão para visualizar</div>
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

          {analyticsState.lineChart !== "ok" ? (
            <div className="h-72 mt-4 flex items-center justify-center text-sm text-muted-foreground border rounded-md">
              {analyticsState.lineChart === "forbidden" ? "Sem permissão para carregar o gráfico." : "Falha ao carregar o gráfico."}
            </div>
          ) : (
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
          )}
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Top matérias (14 dias)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {analyticsState.topMaterias === "forbidden" && <li className="text-muted-foreground">Sem permissão para visualizar.</li>}
            {analyticsState.topMaterias === "ok" && analytics.topMaterias.length === 0 && <li className="text-muted-foreground">Sem dados ainda.</li>}
            {analytics.topMaterias.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="line-clamp-1">{item.titulo}</span>
                <strong>{item.views}</strong>
              </li>
            ))}
          </ul>

          <h3 className="font-semibold mt-6">Top projetos (14 dias)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {analyticsState.topProjetos === "forbidden" && <li className="text-muted-foreground">Sem permissão para visualizar.</li>}
            {analyticsState.topProjetos === "ok" && analytics.topProjetos.length === 0 && <li className="text-muted-foreground">Sem dados ainda.</li>}
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
