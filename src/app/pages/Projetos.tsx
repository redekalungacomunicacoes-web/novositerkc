import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { RKCCard, RKCCardImage, RKCCardContent } from "@/app/components/RKCCard";
import { RKCTag } from "@/app/components/RKCTag";
import { RKCButton } from "@/app/components/RKCButton";
import { RKCProjectsCarousel } from "@/app/components/RKCProjectsCarousel";

import { supabase } from "@/lib/supabase";

type ProjetoUI = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  imagem: string;
  tag: string;
  ano: string;
  status: "Ativo" | "Concluído";
};

export function Projetos() {
  const [loading, setLoading] = useState(true);
  const [projetos, setProjetos] = useState<ProjetoUI[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("projetos")
        .select("id, slug, titulo, resumo, descricao, capa_url, sort_order, publicado_transparencia, published_at, created_at")
        // ✅ NÃO despublica nada: mantém exatamente sua regra pública
        .eq("publicado_transparencia", true)
        // ✅ ORDEM MANUAL PRIMEIRO (null vai pro final)
        .order("sort_order", { ascending: true, nullsFirst: false })
        // fallback por data (caso não tenha sort_order)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      setLoading(false);

      if (error) {
        console.warn("Erro ao carregar projetos:", error.message);
        setProjetos([]);
        return;
      }

      const mapped: ProjetoUI[] = (data || []).map((p: any) => ({
        id: p.id,
        slug: p.slug,
        titulo: p.titulo || "",
        descricao: p.resumo || p.descricao || "",
        imagem: p.capa_url || "",
        tag: "Projeto",
        ano: "—",
        status: "Ativo",
      }));

      setProjetos(mapped);
    })();
  }, []);

  const projetosAtivos = useMemo(() => projetos.filter((p) => p.status === "Ativo"), [projetos]);
  const projetosConcluidos = useMemo(() => projetos.filter((p) => p.status === "Concluído"), [projetos]);

  return (
    <div>
      {/* Hero */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[#F2B705] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">Nossos Projetos</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            Iniciativas que fortalecem cultura, comunicação e sustentabilidade no Território Kalunga
          </p>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-white"
          style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }}
        />
      </section>

      {/* Projetos */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-2">Projetos</h2>
            <p className="text-gray-600">Explore nossos projetos em formato de galeria</p>
          </div>

          {loading && <div className="text-sm text-gray-500 mb-8">Carregando projetos...</div>}

          {!loading && projetosAtivos.length === 0 && (
            <div className="text-sm text-gray-500 mb-8">Nenhum projeto publicado ainda.</div>
          )}

          {!loading && projetosAtivos.length > 0 && (
            <RKCProjectsCarousel
              items={projetosAtivos}
              autoplay
              autoplayMs={8000} // mais lento
              transitionMs={1200} // transição suave
              renderItem={(projeto) => (
                <Link key={projeto.id} to={`/projetos/${projeto.slug}`}>
                  <RKCCard className="h-full hover:scale-[1.02] transition-transform">
                    <RKCCardImage src={projeto.imagem} alt={projeto.titulo} />
                    <RKCCardContent>
                      <div className="flex items-center justify-between mb-3">
                        <RKCTag variant="green">{projeto.tag}</RKCTag>
                        <span className="text-xs text-gray-500">{projeto.ano}</span>
                      </div>
                      <h3 className="font-bold text-xl mb-3 text-[#2E2E2E]">{projeto.titulo}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed mb-4">{projeto.descricao}</p>
                      <div className="flex items-center text-[#0F7A3E] font-medium text-sm">
                        Saiba mais
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </RKCCardContent>
                  </RKCCard>
                </Link>
              )}
            />
          )}

          {/* Se você tiver seção concluídos no seu projeto, ela fica aqui (não quebra layout) */}
          {projetosConcluidos.length > 0 && (
            <div className="mt-16">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-[#2E2E2E] mb-2">Projetos Concluídos</h3>
                <p className="text-gray-600">Trabalhos finalizados que deixaram legados importantes</p>
              </div>

              <RKCProjectsCarousel
                items={projetosConcluidos}
                autoplay
                autoplayMs={9000}
                transitionMs={1200}
                renderItem={(projeto) => (
                  <Link key={projeto.id} to={`/projetos/${projeto.slug}`}>
                    <RKCCard className="h-full hover:scale-[1.02] transition-transform">
                      <RKCCardImage src={projeto.imagem} alt={projeto.titulo} />
                      <RKCCardContent>
                        <RKCTag variant="brown" className="mb-3">
                          {projeto.tag}
                        </RKCTag>
                        <h3 className="font-bold text-xl mb-3 text-[#2E2E2E]">{projeto.titulo}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{projeto.descricao}</p>
                      </RKCCardContent>
                    </RKCCard>
                  </Link>
                )}
              />
            </div>
          )}

          <div className="text-center mt-12">
            <Link to="/contato">
              <RKCButton>
                Entrar em contato
                <ArrowRight className="w-4 h-4" />
              </RKCButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
