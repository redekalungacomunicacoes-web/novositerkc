import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Users, Users2, Mail, Eye, HandCoins, ListTodo, GraduationCap, ChevronDown, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useVisibleAdminLinks } from "@/app/components/admin/AdminSidebar";
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
  daily: Array<{ date: string; day: string; site: number; materias: number }>;
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

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDailySeries(rawDaily: unknown, days = 14): DashboardAnalytics["daily"] {
  const safeDays = Math.max(1, days);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const rawMap = new Map<string, { site: number; materias: number }>();
  if (Array.isArray(rawDaily)) {
    for (const item of rawDaily) {
      const date = typeof item?.day === "string" ? item.day.slice(0, 10) : "";
      if (!date) continue;

      rawMap.set(date, {
        site: toNullableNumber(item?.site) ?? 0,
        materias: toNullableNumber(item?.materias) ?? 0,
      });
    }
  }

  return Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (safeDays - 1 - index));
    const key = formatDateKey(date);
    const day = key.slice(5);
    const values = rawMap.get(key);

    return {
      date: key,
      day,
      site: values?.site ?? 0,
      materias: values?.materias ?? 0,
    };
  });
}

export function Dashboard() {
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(EMPTY_ANALYTICS);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [countState, setCountState] = useState<CountBlockState>(INITIAL_COUNT_STATE);
  const [analyticsState, setAnalyticsState] = useState<AnalyticsBlockState>(INITIAL_ANALYTICS_STATE);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [quickRoles, setQuickRoles] = useState<string[]>([]);
  const [loadingQuickRoles, setLoadingQuickRoles] = useState(true);

  useEffect(() => {
    let active = true;
    getCurrentUserRoles().then(({ roles }) => {
      if (active) setQuickRoles(roles);
    }).catch(() => {
      // Do not show privileged links when role lookup fails.
    }).finally(() => {
      if (active) setLoadingQuickRoles(false);
    });
    return () => { active = false; };
  }, []);



  useEffect(() => {
    if (!metricsOpen) return;
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
          lineChart: "ok",
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
            lineChart: "ok",
            topMaterias: "forbidden",
            topProjetos: "forbidden",
          };

          fallbackAnalytics.daily = buildDailySeries([], 14);

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
          setAnalytics({ ...EMPTY_ANALYTICS, daily: buildDailySeries([], 14) });
        }

        setLoadingAnalytics(false);
        return;
      }

      const raw = (data ?? {}) as Record<string, any>;
      const nextAnalytics: DashboardAnalytics = {
        siteTotal: toNullableNumber(raw.site_total),
        lastDaysTotal: toNullableNumber(raw.last_days_total),
        daily: buildDailySeries(raw.daily, 14),
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
  }, [metricsOpen]);

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

  const visibleRoutes = new Set(useVisibleAdminLinks(quickRoles).map((link) => link.href));
  const quickActions = [
    { href: "/admin/materias", label: "Matérias", description: "Publicar e acompanhar", icon: FileText },
    { href: "/admin/editais", label: "Editais", description: "Radar e captações", icon: HandCoins },
    { href: "/admin/tarefas", label: "Tarefas", description: "Organizar atividades", icon: ListTodo },
    { href: "/admin/projetos", label: "Projetos", description: "Gerenciar projetos", icon: FolderOpen },
    { href: "/admin/academia", label: "Academia", description: "Cursos e materiais", icon: GraduationCap },
    { href: "/admin/equipe", label: "Equipe", description: "Integrantes e funções", icon: Users2 },
    { href: "/admin/newsletter", label: "Newsletter", description: "Inscritos e campanhas", icon: Mail },
  ].filter((action) => visibleRoutes.has(action.href));

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Painel RKC</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso rápido ao que você precisa.</p>
        </div>
        {visibleRoutes.has("/admin/materias") && (
          <Link to="/admin/materias/nova" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-green-800 px-3 text-sm font-medium text-white hover:bg-green-900">
            Nova matéria <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <section aria-labelledby="rkc-quick-access">
        <h2 id="rkc-quick-access" className="mb-3 text-base font-semibold">Acesso rápido</h2>
        {loadingQuickRoles ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : quickActions.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} to={action.href} className="group flex min-h-24 flex-col justify-between rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-green-600 hover:bg-green-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 sm:p-4">
                  <span className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-green-800" aria-hidden="true" />
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-green-800" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{action.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{action.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nenhum atalho disponível para as permissões atuais.</p>
        )}
      </section>

      <section aria-label="Indicadores e relatórios">
        <button type="button" onClick={() => setMetricsOpen((open) => !open)} aria-expanded={metricsOpen} aria-controls="rkc-dashboard-metrics" className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40">
          <span>
            <span className="block text-sm font-semibold">Indicadores e relatórios</span>
            <span className="block text-xs text-muted-foreground">Visualizar estatísticas somente quando precisar</span>
          </span>
          <ChevronDown className={metricsOpen ? "h-5 w-5 shrink-0 rotate-180 transition-transform" : "h-5 w-5 shrink-0 transition-transform"} aria-hidden="true" />
        </button>
        {metricsOpen && (
          <div id="rkc-dashboard-metrics" className="mt-3 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.title} className="min-w-0 rounded-xl border bg-card p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs leading-tight text-muted-foreground">{stat.title}</span>
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </div>
                    {loadingCounts || (stat.title === "Visualizações no site" && loadingAnalytics) ? (
                      <div className="mt-2 h-7 w-12 animate-pulse rounded bg-muted" aria-label="Carregando indicador" />
                    ) : stat.state === "forbidden" ? (
                      <div className="mt-2 text-xs text-muted-foreground">Sem permissão</div>
                    ) : (
                      <div className="mt-2 text-xl font-bold tabular-nums">{stat.value ?? "—"}</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-card p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold">Visualizações por dia (últimos 14 dias)</h3>
                <p className="mt-1 text-xs text-muted-foreground">Total no período: {loadingAnalytics ? "..." : analytics.lastDaysTotal ?? "—"}</p>
                <div className="mt-4 h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.daily} margin={{ left: 0, right: 4, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis allowDecimals={false} width={28} />
                      <Tooltip />
                      <Line type="monotone" dataKey="site" stroke="#0F7A3E" strokeWidth={3} dot={false} name="Visitas no site" />
                      <Line type="monotone" dataKey="materias" stroke="#2FA866" strokeWidth={2} dot={false} name="Visitas em matérias" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">Top matérias (14 dias)</h3>
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
                <h3 className="mt-6 text-sm font-semibold">Top projetos (14 dias)</h3>
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
        )}
      </section>
    </div>
  );
}
