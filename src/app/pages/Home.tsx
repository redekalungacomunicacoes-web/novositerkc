import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RKCButton } from "@/app/components/RKCButton";
import { RKCCard, RKCCardImage, RKCCardContent } from "@/app/components/RKCCard";
import { RKCTag } from "@/app/components/RKCTag";
import { ArrowRight, Calendar, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSiteSettings, SiteSettings } from "@/lib/siteSettings";

type ProjetoHome = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  imagem: string;
  tag: string;
};

type MateriaHome = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  imagem: string;
  autor: string;
  data: string;
  categoria: string;
};

function formatDateBR(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function Home() {
  const [loadingProjetos, setLoadingProjetos] = useState(true);
  const [loadingMaterias, setLoadingMaterias] = useState(true);

  const [projetos, setProjetos] = useState<ProjetoHome[]>([]);
  const [materias, setMaterias] = useState<MateriaHome[]>([]);

  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingProjetos(true);
      setLoadingMaterias(true);

      const settingsP = getSiteSettings();

      // 🔽 Selects reduzidos (mantém o que é necessário pro UI + ordenação)
      const projetosP = supabase
        .from("projetos")
        .select("id, slug, titulo, resumo, descricao, capa_url, sort_order, publicado_transparencia, published_at, created_at")
        .or("publicado_transparencia.eq.true,publicado_transparencia.is.null")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(4);

      const materiasP = supabase
        .from("materias")
        .select("id, slug, titulo, resumo, capa_url, autor_nome, tags, published_at, created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(6);

      const [settingsR, projetosR, materiasR] = await Promise.allSettled([settingsP, projetosP, materiasP]);
      if (!alive) return;

      // settings
      if (settingsR.status === "fulfilled") {
        setSettings(settingsR.value);
      } else {
        console.warn("Erro ao carregar settings (Home):", (settingsR as any)?.reason?.message || settingsR);
        setSettings(null);
      }

      // projetos
      setLoadingProjetos(false);
      if (projetosR.status === "fulfilled") {
        const { data, error } = projetosR.value as any;
        if (error) {
          console.warn("Erro ao carregar projetos (Home):", error.message);
          setProjetos([]);
        } else {
          const mapped: ProjetoHome[] = (data || []).map((p: any) => ({
            id: p.id,
            slug: p.slug,
            titulo: p.titulo || "",
            descricao: p.resumo || p.descricao || "",
            imagem: p.capa_url || "",
            tag: "Projeto",
          }));
          setProjetos(mapped);
        }
      } else {
        console.warn("Erro ao carregar projetos (Home):", (projetosR as any)?.reason?.message || projetosR);
        setProjetos([]);
      }

      // materias
      setLoadingMaterias(false);
      if (materiasR.status === "fulfilled") {
        const { data, error } = materiasR.value as any;
        if (error) {
          console.warn("Erro ao carregar matérias (Home):", error.message);
          setMaterias([]);
        } else {
          const mapped: MateriaHome[] = (data || []).map((m: any) => ({
            id: m.id,
            slug: m.slug,
            titulo: m.titulo || "",
            resumo: m.resumo || "",
            imagem: m.capa_url || "",
            autor: m.autor_nome || "",
            data: formatDateBR(m.published_at || m.created_at),
            categoria: m.tags && m.tags[0] ? m.tags[0] : "Geral",
          }));
          setMaterias(mapped);
        }
      } else {
        console.warn("Erro ao carregar matérias (Home):", (materiasR as any)?.reason?.message || materiasR);
        setMaterias([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const materiaDestaque = useMemo(() => materias[0], [materias]);
  const materiasSecundarias = useMemo(() => materias.slice(1), [materias]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[70vh] md:min-h-[80vh] flex items-center overflow-hidden">
        {/* Imagem de fundo (SEM FALLBACK: só renderiza se vier do banco) */}
        <div className="absolute inset-0">
          {settings?.home_banner_image_url ? (
            <img
              src={settings.home_banner_image_url}
              alt="Comunidade Kalunga"
              className="w-full h-full object-cover"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-black/20" />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        </div>

        {/* Conteúdo do Hero */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            <RKCTag variant="yellow" className="mb-6">
              Comunicação Popular
            </RKCTag>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              {settings?.home_banner_title || "Amplificando as vozes do Território Kalunga"}
            </h1>
            <p className="text-lg sm:text-xl text-gray-200 mb-8 leading-relaxed">
              {settings?.home_banner_subtitle ||
                "Mídia independente quilombola na Chapada dos Veadeiros, promovendo jornalismo comunitário, cultura e pertencimento territorial."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/quem-somos">
                <RKCButton size="lg">
                  Conheça nossa história
                  <ArrowRight className="w-5 h-5" />
                </RKCButton>
              </Link>
              <Link to="/materias">
                <RKCButton
                  variant="outline"
                  size="lg"
                  className="border-white text-white hover:bg-white hover:text-[#0F7A3E]"
                >
                  Ler matérias
                </RKCButton>
              </Link>
            </div>
          </div>
        </div>

        {/* Faixa orgânica inferior */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 bg-white"
          style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }}
        />
      </section>

      {/* Projetos Section */}
      <section className="pt-0 pb-14 md:pt-2 md:pb-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-4">Nossos Projetos</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Iniciativas que fortalecem cultura, comunicação e sustentabilidade no território quilombola
            </p>
          </div>

          {loadingProjetos && <div className="text-center text-sm text-gray-500 mb-8">Carregando projetos...</div>}

          {!loadingProjetos && projetos.length === 0 && (
            <div className="text-center text-sm text-gray-500 mb-8">Nenhum projeto publicado ainda.</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {projetos.map((projeto) => (
              <Link key={projeto.id} to={`/projetos/${projeto.slug}`}>
                <RKCCard className="h-full hover:scale-[1.02] transition-transform">
                  <RKCCardImage src={projeto.imagem} alt={projeto.titulo} />
                  <RKCCardContent>
                    <RKCTag variant="green" className="mb-3">
                      {projeto.tag}
                    </RKCTag>
                    <h3 className="font-bold text-lg mb-2 text-[#2E2E2E]">{projeto.titulo}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{projeto.descricao}</p>
                  </RKCCardContent>
                </RKCCard>
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Link to="/projetos">
              <RKCButton variant="secondary">
                Ver todos os projetos
                <ArrowRight className="w-4 h-4" />
              </RKCButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Matérias Section com Grid Editorial */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-2">Últimas Matérias</h2>
              <p className="text-gray-600">Jornalismo independente e territorial</p>
            </div>
            <Link to="/materias" className="hidden sm:block">
              <RKCButton variant="outline">Ver todas</RKCButton>
            </Link>
          </div>

          {loadingMaterias && <div className="text-sm text-gray-500 mb-8">Carregando matérias...</div>}

          {!loadingMaterias && materias.length === 0 && (
            <div className="text-sm text-gray-500 mb-8">Nenhuma matéria publicada ainda.</div>
          )}

          {/* Grid Editorial: 1 destaque + 5 menores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Matéria Destaque */}
            {materiaDestaque && (
              <Link to={`/materias/${materiaDestaque.slug}`} className="lg:col-span-2">
                <RKCCard variant="featured" className="h-full hover:scale-[1.01] transition-transform">
                  <div className="grid md:grid-cols-2 gap-0">
                    <RKCCardImage src={materiaDestaque.imagem} alt={materiaDestaque.titulo} aspectRatio="square" />
                    <RKCCardContent className="flex flex-col justify-between p-8">
                      <div>
                        <RKCTag variant="orange" className="mb-4">
                          {materiaDestaque.categoria}
                        </RKCTag>
                        <h3 className="text-2xl font-bold text-[#2E2E2E] mb-3 leading-tight">
                          {materiaDestaque.titulo}
                        </h3>
                        <p className="text-gray-600 mb-4 leading-relaxed">{materiaDestaque.resumo}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {materiaDestaque.autor}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {materiaDestaque.data}
                        </div>
                      </div>
                    </RKCCardContent>
                  </div>
                </RKCCard>
              </Link>
            )}

            {/* Grid de 2 matérias menores (lado) */}
            <div className="space-y-6">
              {materiasSecundarias.slice(0, 2).map((materia) => (
                <Link key={materia.id} to={`/materias/${materia.slug}`}>
                  <RKCCard className="hover:scale-[1.02] transition-transform">
                    <div className="flex gap-4 p-4">
                      <img
                        src={materia.imagem}
                        alt={materia.titulo}
                        className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="flex-1 min-w-0">
                        <RKCTag variant="green" className="mb-2 text-xs">
                          {materia.categoria}
                        </RKCTag>
                        <h4 className="font-bold text-sm mb-2 line-clamp-2 text-[#2E2E2E]">{materia.titulo}</h4>
                        <p className="text-xs text-gray-500">{materia.data}</p>
                      </div>
                    </div>
                  </RKCCard>
                </Link>
              ))}
            </div>
          </div>

          {/* 3 cards em linha */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {materiasSecundarias.slice(2, 5).map((materia) => (
              <Link key={materia.id} to={`/materias/${materia.slug}`}>
                <RKCCard className="h-full hover:scale-[1.02] transition-transform">
                  <RKCCardImage src={materia.imagem} alt={materia.titulo} aspectRatio="video" />
                  <RKCCardContent>
                    <RKCTag variant="green" className="mb-3">
                      {materia.categoria}
                    </RKCTag>
                    <h4 className="font-bold mb-2 line-clamp-2 text-[#2E2E2E]">{materia.titulo}</h4>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{materia.resumo}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{materia.autor}</span>
                      <span>•</span>
                      <span>{materia.data}</span>
                    </div>
                  </RKCCardContent>
                </RKCCard>
              </Link>
            ))}
          </div>

          <div className="text-center mt-8 sm:hidden">
            <Link to="/materias">
              <RKCButton variant="outline">Ver todas as matérias</RKCButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-[#F2B705] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Receba nossas histórias</h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            Assine nossa newsletter e acompanhe as histórias, projetos e transformações do Território Kalunga
          </p>
          <Link to="/newsletter">
            <RKCButton variant="accent" size="lg">
              Assinar Newsletter
              <ArrowRight className="w-5 h-5" />
            </RKCButton>
          </Link>
        </div>
      </section>

      {/* Chamada Institucional Final */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-6">
                {settings?.home_territory_title || "Comunicação que nasce do território"}
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {settings?.home_territory_subtitle ||
                  "A Rede Kalunga Comunicações (RKC) é uma iniciativa de mídia independente que surge das comunidades quilombolas da Chapada dos Veadeiros."}
              </p>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Nossa missão é amplificar as vozes do território, promover o jornalismo comunitário e fortalecer a cultura
                e identidade quilombola através da comunicação popular.
              </p>
              <Link to="/quem-somos">
                <RKCButton>
                  Conheça a RKC
                  <ArrowRight className="w-4 h-4" />
                </RKCButton>
              </Link>
            </div>

            {/* Imagem do território (SEM FALLBACK: só renderiza se vier do banco) */}
            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden">
                {settings?.home_territory_image_url ? (
                  <img
                    src={settings.home_territory_image_url}
                    alt="Território Kalunga"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full bg-black/10" />
                )}
              </div>

              {/* Elementos decorativos */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#F2B705] rounded-full opacity-80 blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-[#0F7A3E] rounded-full opacity-60 blur-2xl" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
