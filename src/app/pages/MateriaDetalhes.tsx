import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RKCButton } from "@/app/components/RKCButton";
import { RKCTag } from "@/app/components/RKCTag";
import { RKCCard, RKCCardImage, RKCCardContent } from "@/app/components/RKCCard";
import { ArrowLeft, Calendar, User, Share2, Facebook, Instagram, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

type MateriaUI = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  imagem: string;
  autor: string;
  data: string;
  categoria: string;
  conteudo: string;
};

function formatDateBR(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function MateriaDetalhes() {
  // Compatível com rota antiga (:id) e com a rota recomendada (:slug)
  const params = useParams();
  const paramValue = (params as any).slug || (params as any).id;

  const [loading, setLoading] = useState(true);
  const [materia, setMateria] = useState<MateriaUI | null>(null);
  const [outrasMateria, setOutrasMateria] = useState<Array<{ id: string; slug: string; titulo: string; imagem: string; categoria: string }>>([]);

  const fallbackMateria = useMemo<MateriaUI>(() => ({
    id: "",
    slug: "",
    titulo: "",
    resumo: "",
    imagem: "",
    autor: "",
    data: "",
    categoria: "",
    conteudo: "",
  }), []);

  useEffect(() => {
    if (!paramValue) return;

    (async () => {
      setLoading(true);

      // 1) tenta buscar por slug (recomendado)
      let found: any = null;

      const bySlug = await supabase
        .from("materias")
        .select("id, slug, titulo, resumo, capa_url, autor_nome, tags, conteudo, published_at, created_at, status")
        .eq("slug", paramValue)
        .eq("status", "published")
        .limit(1);

      if (!bySlug.error && bySlug.data && bySlug.data.length > 0) {
        found = bySlug.data[0];
      } else {
        // 2) fallback: se a rota ainda estiver usando id
        const byId = await supabase
          .from("materias")
          .select("id, slug, titulo, resumo, capa_url, autor_nome, tags, conteudo, published_at, created_at, status")
          .eq("id", paramValue)
          .eq("status", "published")
          .limit(1);

        if (!byId.error && byId.data && byId.data.length > 0) {
          found = byId.data[0];
        }
      }

      if (!found) {
        setLoading(false);
        setMateria(null);
        setOutrasMateria([]);
        return;
      }

      const mapped: MateriaUI = {
        id: found.id,
        slug: found.slug,
        titulo: found.titulo || "",
        resumo: found.resumo || "",
        imagem: found.capa_url || "",
        autor: found.autor_nome || "",
        data: formatDateBR(found.published_at || found.created_at),
        categoria: (found.tags && found.tags[0]) ? found.tags[0] : "Geral",
        conteudo: found.conteudo || "",
      };

      setMateria(mapped);

      // "Leia também": mais 3 publicadas, excluindo a atual
      const { data: rel, error: relErr } = await supabase
        .from("materias")
        .select("id, slug, titulo, capa_url, tags, published_at, created_at, status")
        .eq("status", "published")
        .neq("id", found.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(3);

      if (!relErr) {
        setOutrasMateria(
          (rel || []).map((m: any) => ({
            id: m.id,
            slug: m.slug,
            titulo: m.titulo || "",
            imagem: m.capa_url || "",
            categoria: (m.tags && m.tags[0]) ? m.tags[0] : "Geral",
          }))
        );
      } else {
        setOutrasMateria([]);
      }

      setLoading(false);
    })();
  }, [paramValue]);

  const m = materia || fallbackMateria;

  return (
    <div>
      {/* Hero com imagem */}
      <section className="relative h-[70vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={m.imagem}
            alt={m.titulo}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>

        <div className="relative z-10 w-full pb-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Link to="/materias" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar para Matérias
            </Link>

            <RKCTag variant="yellow" className="mb-4">{m.categoria}</RKCTag>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight max-w-3xl">
              {m.titulo}
            </h1>
            <p className="text-xl text-white/90 mb-6 leading-relaxed max-w-2xl">
              {m.resumo}
            </p>
            <div className="flex items-center gap-6 text-white/80">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5" />
                <span>{m.autor}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{m.data}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo */}
      <article className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {loading && (
            <div className="text-sm text-gray-500 mb-8">Carregando matéria...</div>
          )}

          {!loading && !materia && (
            <div className="text-sm text-gray-500 mb-8">Matéria não encontrada ou não publicada.</div>
          )}

          {!!materia && (
            <>
              <div className="prose prose-lg max-w-none">
                <div
                  className="article-content text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: m.conteudo }}
                  style={{
                    fontSize: "1.125rem",
                    lineHeight: "1.8",
                  }}
                />
              </div>

              {/* Compartilhar */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <h3 className="font-bold text-lg text-[#2E2E2E]">Compartilhe esta matéria</h3>
                  <div className="flex gap-3">
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center">
                      <Facebook className="w-5 h-5 text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center">
                      <Mail className="w-5 h-5 text-white" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sobre o autor */}
              <div className="mt-12">
                <RKCCard className="bg-gradient-to-br from-[#0F7A3E]/5 to-[#2FA866]/5">
                  <RKCCardContent className="p-8">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] flex items-center justify-center flex-shrink-0">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-[#2E2E2E] mb-2">
                          {m.autor}
                        </h4>
                        <p className="text-gray-600 leading-relaxed">
                          Jornalista comunitária da Rede Kalunga Comunicações,
                          dedicada a contar as histórias do território quilombola
                          e fortalecer a comunicação popular.
                        </p>
                      </div>
                    </div>
                  </RKCCardContent>
                </RKCCard>
              </div>
            </>
          )}
        </div>
      </article>

      {/* Newsletter CTA */}
      <section className="py-16 bg-gradient-to-br from-[#0F7A3E] to-[#2FA866]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Gostou desta matéria?
          </h2>
          <p className="text-lg text-white/90 mb-8">
            Assine nossa newsletter e receba mais histórias do Território Kalunga
          </p>
          <Link to="/newsletter">
            <RKCButton variant="accent" size="lg">
              Assinar Newsletter
            </RKCButton>
          </Link>
        </div>
      </section>

      {/* Outras Matérias */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#2E2E2E] mb-8">
            Leia também
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {outrasMateria.map((outra) => (
              <Link key={outra.id} to={`/materias/${outra.slug}`}>
                <RKCCard className="h-full hover:scale-[1.02] transition-transform">
                  <RKCCardImage src={outra.imagem} alt={outra.titulo} />
                  <RKCCardContent>
                    <RKCTag variant="green" className="mb-3">{outra.categoria}</RKCTag>
                    <h3 className="font-bold text-lg text-[#2E2E2E]">
                      {outra.titulo}
                    </h3>
                  </RKCCardContent>
                </RKCCard>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Estilos inline para o conteúdo da matéria */}
      <style>{`
        .article-content h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0F7A3E;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }

        .article-content p {
          margin-bottom: 1.5rem;
        }

        .article-content p:first-child::first-letter {
          font-size: 3.5rem;
          font-weight: 700;
          line-height: 1;
          float: left;
          margin-right: 0.5rem;
          margin-top: 0.1rem;
          color: #0F7A3E;
        }
      `}</style>
    </div>
  );
}
