import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  ImageUp,
  MousePointerClick,
  Pencil,
  Plus,
  Power,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { uploadSiteImage } from "@/lib/siteDrive";

type PopupRow = {
  id: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  image_url: string | null;
  youtube_url: string | null;
  cta_label: string;
  cta_url: string | null;
  active: boolean;
  target_path: string;
  impression_count: number;
  click_count: number;
  close_count: number;
};

type Materia = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string | null;
  capa_url: string | null;
  capa_thumb_url: string | null;
  published_at: string | null;
};

type PopupMetric = {
  popup_id: string;
  impression_count: number;
  click_count: number;
  close_count: number;
};

const blank = {
  title: "",
  eyebrow: "Novidade",
  description: "",
  image_url: "",
  youtube_url: "",
  cta_label: "Assistir agora",
  cta_url: "",
  active: false,
  target_path: "/",
};

const pageOptions = [
  ["/", "Home"],
  ["/projetos", "Projetos"],
  ["/materias", "Matérias"],
  ["/quem-somos", "Quem Somos"],
  ["/newsletter", "Newsletter"],
  ["/contato", "Contato"],
] as const;

const pageLabel = (path: string) => pageOptions.find(([value]) => value === path)?.[1] || path;

export function AdminPopups() {
  const [items, setItems] = useState<PopupRow[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [form, setForm] = useState(blank);
  const [edit, setEdit] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"custom" | "materia">("custom");
  const [materiaId, setMateriaId] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [popupRes, metricRes, materiaRes] = await Promise.all([
      supabase.from("site_popups").select("*").order("created_at", { ascending: false }),
      supabase
        .from("site_popup_metrics")
        .select("popup_id,impression_count,click_count,close_count"),
      supabase
        .from("materias")
        .select("id,slug,titulo,resumo,capa_url,capa_thumb_url,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false }),
    ]);

    if (popupRes.error) {
      toast.error(popupRes.error.message);
    } else {
      const metricMap = new Map(
        ((metricRes.data || []) as PopupMetric[]).map((metric) => [metric.popup_id, metric]),
      );

      setItems(
        (popupRes.data || []).map((popup: any) => {
          const metric = metricMap.get(popup.id);
          return {
            ...popup,
            impression_count: Number(metric?.impression_count || 0),
            click_count: Number(metric?.click_count || 0),
            close_count: Number(metric?.close_count || 0),
          } as PopupRow;
        }),
      );
    }

    if (metricRes.error) {
      toast.error("Não foi possível carregar as métricas dos pop-ups.");
    }

    if (materiaRes.error) {
      toast.error("Não foi possível carregar as matérias.");
    } else {
      setMaterias((materiaRes.data || []) as Materia[]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function start(popup?: PopupRow) {
    setSource("custom");
    setMateriaId("");

    if (popup) {
      setEdit(popup.id);
      setForm({
        title: popup.title,
        eyebrow: popup.eyebrow || "",
        description: popup.description || "",
        image_url: popup.image_url || "",
        youtube_url: popup.youtube_url || "",
        cta_label: popup.cta_label,
        cta_url: popup.cta_url || "",
        active: popup.active,
        target_path: popup.target_path || "/",
      });
    } else {
      setEdit(null);
      setForm(blank);
    }

    setOpen(true);
  }

  function chooseMateria(id: string) {
    setMateriaId(id);
    const materia = materias.find((item) => item.id === id);
    if (!materia) return;

    setForm((current) => ({
      ...current,
      eyebrow: "Matéria em destaque",
      title: materia.titulo,
      description: materia.resumo || "",
      image_url: materia.capa_thumb_url || materia.capa_url || "",
      youtube_url: "",
      cta_label: "Ler matéria",
      cta_url: `${window.location.origin}/materias/${materia.slug}`,
    }));
  }

  async function uploadThumb(file?: File) {
    if (!file) return;
    setUploading(true);

    try {
      const url = await uploadSiteImage(file, "banner");
      setForm((current) => ({ ...current, image_url: url }));
      toast.success("Thumbnail enviada ao Drive RKC.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload da thumbnail.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Informe o título.");

    setBusy(true);
    const payload = {
      ...form,
      title: form.title.trim(),
      eyebrow: form.eyebrow || null,
      description: form.description || null,
      image_url: form.image_url || null,
      youtube_url: form.youtube_url || null,
      cta_url: form.cta_url || form.youtube_url || null,
    };

    const { error } = edit
      ? await supabase.from("site_popups").update(payload).eq("id", edit)
      : await supabase.from("site_popups").insert(payload);

    setBusy(false);

    if (error) return toast.error(error.message);

    toast.success("Pop-up salvo.");
    setOpen(false);
    await load();
  }

  async function toggle(popup: PopupRow) {
    const { error } = await supabase.from("site_popups").update({ active: !popup.active }).eq("id", popup.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        !popup.active
          ? `Ativado em ${pageLabel(popup.target_path || "/")}; outro ativo nessa página foi desativado.`
          : "Desativado.",
      );
      await load();
    }
  }

  async function del(popup: PopupRow) {
    if (!confirm(`Excluir “${popup.title}”?`)) return;
    const { error } = await supabase.from("site_popups").delete().eq("id", popup.id);
    if (error) toast.error(error.message);
    else await load();
  }

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, popup) => ({
          impressions: acc.impressions + popup.impression_count,
          clicks: acc.clicks + popup.click_count,
          closes: acc.closes + popup.close_count,
        }),
        { impressions: 0, clicks: 0, closes: 0 },
      ),
    [items],
  );

  const preview = useMemo(() => form, [form]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Pop-ups</h1>
          <p className="mt-1 text-muted-foreground">
            Destaques por página, com contadores de exibição, clique e fechamento.
          </p>
        </div>

        <button
          onClick={() => start()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Novo pop-up
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Exibições" value={totals.impressions} icon={Eye} />
        <Metric label="Cliques" value={totals.clicks} icon={MousePointerClick} />
        <Metric label="Fechamentos" value={totals.closes} icon={XCircle} />
      </div>

      <div className="grid gap-4">
        {items.map((popup) => {
          const ctr =
            popup.impression_count > 0
              ? ((popup.click_count / popup.impression_count) * 100).toFixed(1)
              : "0.0";

          return (
            <div
              key={popup.id}
              className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="h-24 w-full overflow-hidden rounded-lg bg-muted sm:w-40">
                {popup.image_url ? (
                  <img src={popup.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Sem imagem
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      popup.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {popup.active ? "ATIVO" : "INATIVO"}
                  </span>
                  <span className="text-xs text-muted-foreground">{popup.eyebrow}</span>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    {pageLabel(popup.target_path || "/")}
                  </span>
                </div>

                <h2 className="mt-2 text-lg font-bold">{popup.title}</h2>
                <p className="line-clamp-2 text-sm text-muted-foreground">{popup.description}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {popup.impression_count} exibido
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5">
                    <MousePointerClick className="h-3.5 w-3.5" />
                    {popup.click_count} cliques
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    {popup.close_count} fechamentos
                  </span>
                  <span className="rounded-md bg-green-50 px-2.5 py-1.5 font-semibold text-green-700">
                    CTR {ctr}%
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggle(popup)}
                  className={`rounded-md border p-2 transition-colors ${
                    popup.active
                      ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                      : "text-muted-foreground hover:border-green-500 hover:text-green-700"
                  }`}
                  title={popup.active ? "Ligado — clique para desativar" : "Desligado — clique para ativar"}
                  aria-pressed={popup.active}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button onClick={() => start(popup)} className="rounded-md border p-2">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => del(popup)} className="rounded-md border p-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}

        {!items.length && (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            Nenhum pop-up criado.
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-background p-6 shadow-2xl">
            <div className="mb-5 flex justify-between">
              <div>
                <h2 className="text-xl font-bold">{edit ? "Editar" : "Novo"} pop-up</h2>
                <p className="text-sm text-muted-foreground">
                  Crie manualmente ou reaproveite uma matéria publicada.
                </p>
              </div>
              <button onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-4">
                <div>
                  <span className="mb-2 block text-sm font-semibold">Origem do conteúdo</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSource("custom");
                        setMateriaId("");
                      }}
                      className={`rounded-lg border p-3 text-sm font-semibold ${
                        source === "custom" ? "border-primary bg-primary/10 text-primary" : ""
                      }`}
                    >
                      Personalizado
                    </button>
                    <button
                      onClick={() => setSource("materia")}
                      className={`rounded-lg border p-3 text-sm font-semibold ${
                        source === "materia" ? "border-primary bg-primary/10 text-primary" : ""
                      }`}
                    >
                      Matéria publicada
                    </button>
                  </div>
                </div>

                {source === "materia" && (
                  <label>
                    <span className="mb-1 block text-sm font-medium">Escolha uma matéria</span>
                    <select
                      value={materiaId}
                      onChange={(event) => chooseMateria(event.target.value)}
                      className="h-11 w-full rounded-md border bg-background px-3"
                    >
                      <option value="">Selecione...</option>
                      {materias.map((materia) => (
                        <option key={materia.id} value={materia.id}>
                          {materia.titulo}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Título, resumo, capa e link são preenchidos automaticamente e continuam editáveis.
                    </span>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Página onde o pop-up será exibido</span>
                  <select
                    value={form.target_path}
                    onChange={(event) => setForm({ ...form, target_path: event.target.value })}
                    className="h-11 w-full rounded-md border bg-background px-3"
                  >
                    {pageOptions.map(([path, label]) => (
                      <option key={path} value={path}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Pode existir um pop-up ativo em cada página ao mesmo tempo.
                  </span>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["eyebrow", "Etiqueta"],
                      ["title", "Título"],
                      ["youtube_url", "Link do YouTube"],
                      ["cta_label", "Texto do botão"],
                      ["cta_url", "Link do botão"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className={key === "title" ? "sm:col-span-2" : ""}>
                      <span className="mb-1 block text-sm font-medium">{label}</span>
                      <input
                        value={form[key]}
                        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                        className="h-10 w-full rounded-md border bg-background px-3"
                      />
                    </label>
                  ))}

                  <div className="sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium">Thumbnail / imagem</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={form.image_url}
                        onChange={(event) => setForm({ ...form, image_url: event.target.value })}
                        placeholder="URL da imagem ou faça upload"
                        className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3"
                      />
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(event) => {
                          void uploadThumb(event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 font-semibold hover:bg-muted disabled:opacity-60"
                      >
                        <ImageUp className="h-4 w-4" />
                        {uploading ? "Enviando..." : form.image_url ? "Trocar thumbnail" : "Enviar thumbnail"}
                      </button>
                    </div>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      JPEG, PNG, WebP ou GIF, até 25 MB. O arquivo vai para o Drive institucional da RKC.
                    </span>
                  </div>

                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium">Descrição</span>
                    <textarea
                      value={form.description}
                      onChange={(event) => setForm({ ...form, description: event.target.value })}
                      className="min-h-24 w-full rounded-md border bg-background p-3"
                    />
                  </label>

                  <label className="flex items-center gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => setForm({ ...form, active: event.target.checked })}
                    />
                    Ativar ao salvar (desativa somente outro pop-up ativo nesta mesma página)
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Pré-visualização</p>
                <div className="overflow-hidden rounded-2xl border bg-white shadow-lg">
                  {preview.image_url ? (
                    <img src={preview.image_url} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">
                      Imagem/thumbnail
                    </div>
                  )}
                  <div className="p-5">
                    {preview.eyebrow && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase text-green-800">
                        {preview.eyebrow}
                      </span>
                    )}
                    <h3 className="mt-3 text-2xl font-bold text-slate-900">
                      {preview.title || "Título do destaque"}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {preview.description || "A descrição aparecerá aqui."}
                    </p>
                    <span className="mt-4 inline-block rounded-lg bg-[#0F7A3E] px-4 py-2 text-sm font-semibold text-white">
                      {preview.cta_label || "Saiba mais"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border px-4 py-2">
                Cancelar
              </button>
              <button
                disabled={busy}
                onClick={save}
                className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
              >
                {busy ? "Salvando..." : "Salvar pop-up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Eye;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
