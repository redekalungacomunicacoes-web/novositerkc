import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RKCButton } from "@/app/components/RKCButton";
import { RKCCard, RKCCardContent } from "@/app/components/RKCCard";
import {
  Heart,
  Users,
  Target,
  Megaphone,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSiteSettings, SiteSettings } from "@/lib/siteSettings";
import avatarPlaceholder from "@/assets/avatar-placeholder.svg";

const TEAM_AVATARS_BUCKET = "team-avatars";

// ---------------------------------------------------------------------------
// Tipagem
// ---------------------------------------------------------------------------

type MembroEquipe = {
  id: string;
  name: string;
  nome?: string;
  slug?: string | null;
  avatarUrl?: string | null;
  order_index?: number | null;
};

type QuemSomosData = {
  historia: string | null;
  missao?: string | null;
  visao?: string | null;
  imagem_url: string | null;
};

type ValorDB = {
  id: string;
  titulo: string;
  descricao: string | null;
  ordem: number | null;
};

// ✅ IMPORTANTE: no seu banco o id de quem_somos é INTEGER
const QUEM_SOMOS_ID = 1;

// ---------------------------------------------------------------------------
// Sub-componente: Card do membro (grid)
// ---------------------------------------------------------------------------

interface MemberCardProps {
  membro: MembroEquipe;
}

function MemberCard({ membro }: MemberCardProps) {
  const hasAvatar = !!membro.avatarUrl;
  const cardContent = (
    <>
      <div className="relative overflow-hidden aspect-square bg-gray-100">
        {hasAvatar ? (
          <img
            src={membro.avatarUrl || avatarPlaceholder}
            alt={`Foto de ${membro.name}`}
            loading="lazy"
            decoding="async"
            width={320}
            height={320}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.currentTarget.src = avatarPlaceholder;
            }}
          />
        ) : (
          <img
            src={avatarPlaceholder}
            alt="Sem foto"
            loading="lazy"
            decoding="async"
            width={320}
            height={320}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      <div className="p-3">
        <p className="font-bold text-[#2E2E2E] text-sm leading-tight truncate">
          {membro.name}
        </p>
      </div>
    </>
  );

  if (!membro.slug) {
    return (
      <div className="group block w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      to={`/equipe/${membro.slug}`}
      className="group block w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F7A3E] focus-visible:ring-offset-2"
    >
      {cardContent}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function QuemSomos() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [quemSomos, setQuemSomos] = useState<QuemSomosData | null>(null);
  const [valoresDB, setValoresDB] = useState<ValorDB[]>([]);

  const [loadingEquipe, setLoadingEquipe] = useState(true);
  const [equipeError, setEquipeError] = useState<string | null>(null);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);

  const getPublicUrlOnce = (path: string) => {
    return supabase.storage.from(TEAM_AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const getAvatarUrl = (member: any) => {
    const rawAvatarUrl = typeof member.avatar_url === "string" ? member.avatar_url.trim() : "";
    if (rawAvatarUrl) {
      if (/^https?:\/\//i.test(rawAvatarUrl)) return rawAvatarUrl;
      return getPublicUrlOnce(rawAvatarUrl);
    }

    const thumbPath = typeof member.avatar_thumb_path === "string" ? member.avatar_thumb_path.trim() : "";
    if (thumbPath) return getPublicUrlOnce(thumbPath);

    const avatarPath = typeof member.avatar_path === "string" ? member.avatar_path.trim() : "";
    if (avatarPath) return getPublicUrlOnce(avatarPath);

    const legacyUrl = typeof member.foto_url === "string" ? member.foto_url.trim() : "";
    if (!legacyUrl) return null;
    if (/^https?:\/\//i.test(legacyUrl)) return legacyUrl;
    return getPublicUrlOnce(legacyUrl);
  };

  // Fallback (se ainda não cadastrou valores no banco)
  const valoresFallback = useMemo(
    () => [
      {
        icon: Heart,
        titulo: "Pertencimento",
        descricao:
          "Enraizamento territorial e valorização da identidade quilombola",
      },
      {
        icon: Users,
        titulo: "Comunidade",
        descricao:
          "Comunicação feita pela e para as comunidades do território quilombola",
      },
      {
        icon: Target,
        titulo: "Autonomia",
        descricao: "Jornalismo independente e livre de interesses comerciais",
      },
      {
        icon: Megaphone,
        titulo: "Amplificação",
        descricao:
          "Dar voz e visibilidade às narrativas do território quilombola",
      },
    ],
    []
  );

  // Valores do banco (com ícone padrão)
  const valoresParaRender = useMemo(() => {
    if (valoresDB.length) {
      return valoresDB
        .slice()
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        .map((v) => ({
          icon: Sparkles,
          titulo: v.titulo,
          descricao: v.descricao || "",
        }));
    }
    return valoresFallback;
  }, [valoresDB, valoresFallback]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setLoadingEquipe(true);

        // Carrega tudo em paralelo (otimização)
        const [settingsRes, quemSomosRes, valoresRes, equipeRes] =
          await Promise.all([
            getSiteSettings().catch(() => null),

            supabase
              .from("quem_somos")
              .select("historia, missao, visao, imagem_url")
              .eq("id", QUEM_SOMOS_ID)
              .maybeSingle(),

            supabase
              .from("valores")
              .select("id, titulo, descricao, ordem")
              .order("ordem", { ascending: true }),

            supabase
              .from("equipe")
              .select("id, nome, slug, avatar_thumb_path, avatar_path, avatar_url, foto_url, is_public, order_index")
              .eq("is_public", true)
              .order("order_index", { ascending: true })
              .order("nome", { ascending: true }),
          ]);

        if (!mounted) return;

        // settings
        setSettings(settingsRes);

        // quem_somos
        if (!quemSomosRes.error) {
          setQuemSomos((quemSomosRes.data as QuemSomosData) || null);
        } else {
          console.warn("Erro ao carregar quem_somos:", quemSomosRes.error.message);
          setQuemSomos(null);
        }

        // valores
        if (!valoresRes.error) {
          setValoresDB((valoresRes.data as ValorDB[]) || []);
        } else {
          console.warn("Erro ao carregar valores:", valoresRes.error.message);
          setValoresDB([]);
        }

        // equipe
        setLoadingEquipe(false);

        if (equipeRes.error) {
          const maybeMissingAvatarUrlColumn = /avatar_url/i.test(equipeRes.error.message || "");
          if (maybeMissingAvatarUrlColumn) {
            const retryEquipeRes = await supabase
              .from("equipe")
              .select("id, nome, slug, avatar_thumb_path, avatar_path, foto_url, is_public, order_index")
              .eq("is_public", true)
              .order("order_index", { ascending: true })
              .order("nome", { ascending: true });

            if (retryEquipeRes.error) {
              console.error("Erro ao carregar equipe:", retryEquipeRes.error);
              setEquipeError("Não foi possível carregar os integrantes agora. Tente novamente em instantes.");
              setEquipe([]);
            } else {
              setEquipeError(null);
              const mapped: MembroEquipe[] = (retryEquipeRes.data || []).map((m: any) => ({
                id: String(m.id),
                name: m.nome || "",
                nome: m.nome || "",
                slug: m.slug ?? null,
                avatarUrl: getAvatarUrl(m),
                order_index: m.order_index ?? null,
              }));
              setEquipe(mapped.slice().sort((a, b) => (a.order_index ?? 999999) - (b.order_index ?? 999999) || a.name.localeCompare(b.name)));
            }
          } else {
            console.error("Erro ao carregar equipe:", equipeRes.error);
            setEquipeError("Não foi possível carregar os integrantes agora. Tente novamente em instantes.");
            setEquipe([]);
          }
        } else {
          setEquipeError(null);
          const mapped: MembroEquipe[] = (equipeRes.data || []).map((m: any) => ({
            id: String(m.id),
            name: m.nome || "",
            nome: m.nome || "",
            slug: m.slug ?? null,
            avatarUrl: getAvatarUrl(m),
            order_index: m.order_index ?? null,
          }));
          setEquipe(mapped.slice().sort((a, b) => (a.order_index ?? 999999) - (b.order_index ?? 999999) || a.name.localeCompare(b.name)));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // História vinda do banco (com fallback pra não quebrar layout)
  const historiaText =
    (quemSomos?.historia || "").trim() ||
    "A Rede Kalunga Comunicações (RKC) é uma mídia independente construída coletivamente para amplificar as vozes do território quilombola.";

  const historiaParagrafos = useMemo(() => {
    return historiaText
      .split(/\n{2,}|\r\n\r\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [historiaText]);

  const missaoText = (quemSomos?.missao || "").trim();
  const visaoText = (quemSomos?.visao || "").trim();

  return (
    <div>
      {/* Hero / Banner */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[#F2B705] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            Quem Somos
          </h1>
          <p className="text-xl text-white/90 leading-relaxed">
            Comunicação popular que nasce do coração do Território Kalunga
          </p>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-white"
          style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }}
        />
      </section>

      {/* Nossa História */}
      <section id="historia" className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-3 text-center">
            Nossa História
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            {settings?.about_team_subtitle ||
              "Uma mídia independente construída coletivamente para amplificar as vozes do território."}
          </p>

          {/* Duas colunas: texto | imagem principal */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Texto */}
            <div className="prose prose-lg max-w-none">
              {historiaParagrafos.map((p, idx) => (
                <p
                  key={idx}
                  className={`text-lg text-gray-700 leading-relaxed ${
                    idx === historiaParagrafos.length - 1 ? "mb-0" : "mb-6"
                  }`}
                >
                  {p}
                </p>
              ))}
            </div>

            {/* Imagem principal (16:9) - limpa */}
            <div className="relative">
              <RKCCard className="overflow-hidden">
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  {quemSomos?.imagem_url ? (
                    <img
                      src={quemSomos.imagem_url}
                      alt="Imagem principal - Quem Somos"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#0F7A3E]/10 flex items-center justify-center text-sm text-gray-400">
                      Imagem principal (configurar em Admin → Quem Somos)
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
              </RKCCard>
            </div>
          </div>
        </div>
      </section>

      {/* Integrantes */}
      <section id="equipe" className="py-16 md:py-20 bg-[#f8faf9] border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E]">
              Conheça cada integrante
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">
              Clique no card para ver o perfil completo, a bio e o Instagram.
            </p>
          </div>

          {loadingEquipe && (
            <p className="text-center text-sm text-gray-400">
              Carregando equipe...
            </p>
          )}

          {!loadingEquipe && equipeError && (
            <p className="text-center text-sm text-red-500">{equipeError}</p>
          )}

          {!loadingEquipe && !equipeError && equipe.length === 0 && (
            <p className="text-center text-sm text-gray-400">
              Nenhum membro cadastrado ainda.
            </p>
          )}

          {!loadingEquipe && !equipeError && equipe.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {equipe.map((m) => (
                <MemberCard key={m.id} membro={m} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Missão e Visão */}
      {(missaoText || visaoText) && (
        <section id="missao-visao" className="py-12 bg-white border-t border-gray-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-10 text-center">
              Missão e Visão
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {missaoText && (
                <RKCCard>
                  <RKCCardContent className="p-8">
                    <h3 className="font-bold text-2xl text-[#2E2E2E] mb-3">
                      Missão
                    </h3>
                    <p className="text-gray-600 leading-relaxed">{missaoText}</p>
                  </RKCCardContent>
                </RKCCard>
              )}

              {visaoText && (
                <RKCCard>
                  <RKCCardContent className="p-8">
                    <h3 className="font-bold text-2xl text-[#2E2E2E] mb-3">
                      Visão
                    </h3>
                    <p className="text-gray-600 leading-relaxed">{visaoText}</p>
                  </RKCCardContent>
                </RKCCard>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Valores */}
      <section id="valores" className="py-16 md:py-24 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-12 text-center">
            Nossos Valores
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {valoresParaRender.map((valor, index) => {
              const Icon = valor.icon;
              return (
                <RKCCard key={index} className="text-center">
                  <RKCCardContent className="p-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-xl text-[#2E2E2E] mb-3">
                      {valor.titulo}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">{valor.descricao}</p>
                  </RKCCardContent>
                </RKCCard>
              );
            })}
          </div>

          {loading && (
            <p className="text-center text-xs text-gray-400 mt-6">
              Carregando conteúdo...
            </p>
          )}
        </div>
      </section>

      {/* CTA */}
      <section id="faca-parte" className="py-16 md:py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-6">
            Faça parte dessa história
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Conheça nossos projetos, leia nossas matérias e entre em contato para
            colaborar com a comunicação popular quilombola.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/projetos">
              <RKCButton size="lg">
                Ver Projetos
                <ArrowRight className="w-5 h-5" />
              </RKCButton>
            </Link>
            <Link to="/contato">
              <RKCButton variant="outline" size="lg">
                Entre em Contato
              </RKCButton>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
