import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RKCTag } from "@/app/components/RKCTag";
import { RKCCard, RKCCardContent } from "@/app/components/RKCCard";
import { ArrowLeft, Calendar, Users, X, Image as ImageIcon, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";

type GaleriaItem = {
  id: string;
  type: "image" | "video";
  url: string;
  title?: string;
  thumb_url?: string;
};

type ProjetoUI = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string; // subtítulo (banner)
  descricaoCompleta: string; // “Sobre o Projeto”
  imagem: string; // banner (capa)
  tag: string;
  ano: string;
  status: string;

  objetivos: string[];
  resultados: string[];

  galeria: GaleriaItem[];
};

function isVideoUrl(url: string) {
  const u = (url || "").toLowerCase();
  return (
    u.endsWith(".mp4") ||
    u.endsWith(".webm") ||
    u.endsWith(".mov") ||
    u.includes("youtube.com") ||
    u.includes("youtu.be") ||
    u.includes("vimeo.com")
  );
}

function getYouTubeEmbed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

type ProjetoGaleriaRow = {
  id: string;
  tipo: "image" | "video";
  url: string;
  titulo: string | null;
  thumb_url: string | null;
  ordem: number | null;
  created_at: string;
};

async function fetchGaleria(projetoId: string): Promise<GaleriaItem[]> {
  const { data, error } = await supabase
    .from("projeto_galeria")
    .select("id, tipo, url, titulo, thumb_url, ordem, created_at")
    .eq("projeto_id", projetoId)
    .order("ordem", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((g: ProjetoGaleriaRow) => ({
    id: g.id,
    type: g.tipo,
    url: g.url,
    title: g.titulo || undefined,
    thumb_url: g.thumb_url || undefined,
  }));
}

export function ProjetoDetalhes() {
  const params = useParams();
  const paramValue = (params as any).slug || (params as any).id;

  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<ProjetoUI | null>(null);

  const [selected, setSelected] = useState<GaleriaItem | null>(null);

  useEffect(() => {
    if (!paramValue) return;

    (async () => {
      setLoading(true);

      const PUBLIC_FILTER = "publicado_transparencia.eq.true,publicado_transparencia.is.null";

      let found: any = null;

      const bySlug = await supabase
        .from("projetos")
        .select("id, slug, titulo, resumo, descricao, capa_url, publicado_transparencia, published_at, created_at")
        .eq("slug", paramValue)
        .or(PUBLIC_FILTER)
        .limit(1);

      if (!bySlug.error && bySlug.data && bySlug.data.length > 0) {
        found = bySlug.data[0];
      } else {
        const byId = await supabase
          .from("projetos")
          .select("id, slug, titulo, resumo, descricao, capa_url, publicado_transparencia, published_at, created_at")
          .eq("id", paramValue)
          .or(PUBLIC_FILTER)
          .limit(1);

        if (!byId.error && byId.data && byId.data.length > 0) {
          found = byId.data[0];
        }
      }

      if (!found) {
        setProjeto(null);
        setLoading(false);
        return;
      }

      // ✅ Galeria do projeto
      let galeria: GaleriaItem[] = [];
      try {
        galeria = await fetchGaleria(found.id);
      } catch (e: any) {
        console.warn("Erro ao carregar galeria do projeto:", e?.message || e);
      }

      const fallbackCapa = galeria.find((g) => g.type === "image")?.url || "";

      const mapped: ProjetoUI = {
        id: found.id,
        slug: found.slug,
        titulo: found.titulo || "",
        // subtítulo (banner) — usa resumo
        descricao: found.resumo || "",
        // texto do “Sobre o Projeto” — usa descricao completa
        descricaoCompleta: found.descricao || found.resumo || "",
        // banner — usa capa_url, senão primeira imagem da galeria
        imagem: found.capa_url || fallbackCapa,
        tag: "Projeto",
        ano: "—",
        status: "Ativo",
        objetivos: [],
        resultados: [],
        galeria,
      };

      setProjeto(mapped);
      setLoading(false);
    })();
  }, [paramValue]);

  const galeriaItems = useMemo(() => {
    const list = projeto?.galeria || [];
    return list.map((it: any) => ({
      ...it,
      type: it.type || (isVideoUrl(it.url) ? "video" : "image"),
    })) as GaleriaItem[];
  }, [projeto]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center text-sm text-gray-500">Carregando projeto...</div>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center text-sm text-gray-500">Projeto não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ✅ BANNER (não mexe em caminhos; só layout) */}
      <section className="relative w-full overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: projeto.imagem ? `url(${projeto.imagem})` : undefined }}
        />
        {!projeto.imagem ? <div className="absolute inset-0 bg-black/10" /> : null}
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative">
          <div className="max-w-6xl mx-auto px-4">
            <div
              className="min-h-[160px] md:min-h-[190px] flex flex-col justify-end pb-8"
              style={{ paddingTop: "clamp(3.5rem, 8vh, 6rem)" }}
            >
              <Link to="/projetos" className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white">
                <ArrowLeft className="w-4 h-4" />
                Voltar para Projetos
              </Link>

              <div className="mt-6">
                <RKCTag>{projeto.tag}</RKCTag>
              </div>

              <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-white">{projeto.titulo}</h1>

              <p className="mt-3 max-w-3xl text-base md:text-lg text-white/90">{projeto.descricao}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ✅ Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <h2 className="text-2xl font-semibold">Sobre o Projeto</h2>
            <p className="mt-3 text-base text-gray-700">{projeto.descricaoCompleta}</p>
          </div>

          {/* ✅ Coluna direita */}
          <div className="space-y-6">
            {/* Informações */}
            <RKCCard>
              <RKCCardContent>
                <div className="text-lg font-semibold">Informações</div>

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Período
                    </span>
                    <span>—</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2">
                      <Users className="w-4 h-4" /> Status
                    </span>
                    <span>{projeto.status}</span>
                  </div>
                </div>
              </RKCCardContent>
            </RKCCard>

            {/* ✅ Quer saber mais? — idêntico ao print */}
            <div className="rounded-2xl bg-gradient-to-b from-emerald-700 to-emerald-600 text-white shadow-lg px-8 py-8">
              <h3 className="text-center text-2xl font-semibold">Quer saber mais?</h3>

              <p className="mt-4 text-center text-base text-white/90 leading-relaxed">
                Entre em contato para conhecer melhor este <br className="hidden sm:block" />
                projeto
              </p>

              <Link
                to="/contato"
                className="mt-6 block w-full rounded-xl bg-yellow-400 hover:bg-yellow-500 text-center
                           py-4 text-lg font-semibold text-gray-900 shadow-md transition-colors"
              >
                Entrar em Contato
              </Link>
            </div>
          </div>
        </div>

        {/* ✅ Galeria */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Galeria do Projeto</h2>

          {galeriaItems.length === 0 ? (
            <div className="mt-4 rounded-xl border p-4 text-sm text-gray-600 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              (Em breve) — quando você cadastrar no Admin, vai aparecer aqui automaticamente.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {galeriaItems.map((item) => {
                const isVid = item.type === "video" || isVideoUrl(item.url);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="group rounded-2xl overflow-hidden border text-left"
                  >
                    <div className="relative">
                      {isVid ? (
                        <div className="h-44 w-full bg-black/5 flex items-center justify-center">
                          <Play className="w-10 h-10 opacity-70" />
                        </div>
                      ) : (
                        <img
                          src={item.thumb_url || item.url}
                          alt={item.title || "Imagem"}
                          className="h-44 w-full object-cover group-hover:scale-[1.02] transition-transform"
                          loading="lazy"
                        />
                      )}
                    </div>

                    {item.title ? <div className="p-3 text-sm text-gray-700">{item.title}</div> : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ✅ Modal */}
        {selected ? (
          <div
            className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b">
                <div className="text-sm font-medium">{selected.title || "Mídia"}</div>
                <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setSelected(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3">
                {selected.type === "video" || isVideoUrl(selected.url) ? (
                  getYouTubeEmbed(selected.url) ? (
                    <iframe
                      src={getYouTubeEmbed(selected.url) as string}
                      title={selected.title || "Vídeo"}
                      className="w-full h-[60vh] rounded-xl"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video src={selected.url} controls className="w-full rounded-xl" />
                  )
                ) : (
                  <img src={selected.url} alt={selected.title || "Imagem"} className="w-full rounded-xl" />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
