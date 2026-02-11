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
  descricao: string;
  descricaoCompleta: string;
  imagem: string;
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

async function fetchGaleria(projetoId: string): Promise<GaleriaItem[]> {
  const { data, error } = await supabase
    .from("projeto_galeria")
    .select("id, tipo, url, titulo, thumb_url, ordem, created_at")
    .eq("projeto_id", projetoId)
    .order("ordem", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((g: any) => ({
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
        .select("id, slug, titulo, resumo, descricao, capa_url")
        .eq("slug", paramValue)
        .or(PUBLIC_FILTER)
        .limit(1);

      if (!bySlug.error && bySlug.data?.length) {
        found = bySlug.data[0];
      } else {
        const byId = await supabase
          .from("projetos")
          .select("id, slug, titulo, resumo, descricao, capa_url")
          .eq("id", paramValue)
          .or(PUBLIC_FILTER)
          .limit(1);

        if (!byId.error && byId.data?.length) {
          found = byId.data[0];
        }
      }

      if (!found) {
        setProjeto(null);
        setLoading(false);
        return;
      }

      let galeria: GaleriaItem[] = [];
      try {
        galeria = await fetchGaleria(found.id);
      } catch {}

      const fallbackCapa = galeria.find((g) => g.type === "image")?.url || "";

      const mapped: ProjetoUI = {
        id: found.id,
        slug: found.slug,
        titulo: found.titulo || "",
        descricao: found.resumo || "",
        descricaoCompleta: found.descricao || found.resumo || "",
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
    return list.map((it) => ({
      ...it,
      type: it.type || (isVideoUrl(it.url) ? "video" : "image"),
    }));
  }, [projeto]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-gray-500">Carregando projeto...</div>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-gray-500">Projeto não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ✅ HERO GRANDE (IGUAL HOME) */}
      <section className="relative h-[70vh] md:h-[80vh] min-h-[520px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {projeto.imagem ? (
            <img
              src={projeto.imagem}
              alt={projeto.titulo}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-black/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-3xl">
            <Link to="/projetos" className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Voltar para Projetos
            </Link>

            <div className="mt-6">
              <RKCTag>{projeto.tag}</RKCTag>
            </div>

            <div className="mt-3 min-h-[200px]">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
                {projeto.titulo}
              </h1>

              <p className="text-lg sm:text-xl text-gray-200">
                {projeto.descricao}
              </p>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-24 bg-white"
          style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }}
        />
      </section>

      {/* RESTO DA PÁGINA */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <h2 className="text-2xl font-semibold">Sobre o Projeto</h2>
            <p className="mt-3 text-base text-gray-700">
              {projeto.descricaoCompleta}
            </p>
          </div>

          <div className="space-y-6">
            <RKCCard>
              <RKCCardContent>
                <div className="text-lg font-semibold">Informações</div>
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Período
                    </span>
                    <span>—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" /> Status
                    </span>
                    <span>{projeto.status}</span>
                  </div>
                </div>
              </RKCCardContent>
            </RKCCard>
          </div>
        </div>
      </div>
    </div>
  );
}
