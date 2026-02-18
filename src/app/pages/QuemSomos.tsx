import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RKCButton } from "@/app/components/RKCButton";
import { RKCCard, RKCCardContent } from "@/app/components/RKCCard";
import { Heart, Users, Target, Megaphone, ArrowRight, Instagram, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSiteSettings, SiteSettings } from "@/lib/siteSettings";

type MembroEquipe = {
  id: string;
  nome: string;
  cargo: string;
  foto_url: string;
  bio?: string | null;
  instagram?: string | null;
};

// ✅ aceita: @user | user | instagram.com/user | https://instagram.com/user
function parseInstagram(raw?: string | null) {
  const v = (raw || "").trim();
  if (!v) return null;

  // URL completa ou "instagram.com/..."
  if (v.includes("instagram.com")) {
    try {
      const url = new URL(v.startsWith("http") ? v : `https://${v}`);
      const parts = url.pathname.split("/").filter(Boolean);
      const handle = (parts[0] || "").replace(/^@/, "");
      if (!handle) return { label: "@instagram", href: url.toString() };
      return { label: `@${handle}`, href: `https://instagram.com/${handle}` };
    } catch {
      const handle = v.split("/").filter(Boolean).pop()?.replace(/^@/, "") || "";
      if (!handle) return { label: "@instagram", href: v };
      return { label: `@${handle}`, href: `https://instagram.com/${handle}` };
    }
  }

  // @handle ou handle puro
  const handle = v.replace(/^@/, "").split("/").filter(Boolean).pop() || "";
  if (!handle) return null;
  return { label: `@${handle}`, href: `https://instagram.com/${handle}` };
}

export function QuemSomos() {
  const valores = [
    { icon: Heart, titulo: "Pertencimento", descricao: "Enraizamento territorial e valorização da identidade quilombola" },
    { icon: Users, titulo: "Comunidade", descricao: "Comunicação feita pela e para as comunidades do território quilombola" },
    { icon: Target, titulo: "Autonomia", descricao: "Jornalismo independente e livre de interesses comerciais" },
    { icon: Megaphone, titulo: "Amplificação", descricao: "Dar voz e visibilidade às narrativas do território quilombola" },
  ];

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loadingEquipe, setLoadingEquipe] = useState(true);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [membroModal, setMembroModal] = useState<MembroEquipe | null>(null);

  useEffect(() => {
    // settings
    (async () => {
      try {
        const s = await getSiteSettings();
        setSettings(s);
      } catch (e: any) {
        console.warn("Erro ao carregar settings (QuemSomos):", e?.message || e);
        setSettings(null);
      }
    })();

    // equipe
    (async () => {
      setLoadingEquipe(true);

      const { data, error } = await supabase
        .from("equipe")
        .select("id, nome, cargo, foto_url, bio, instagram, ordem, ativo")
        .or("ativo.eq.true,ativo.is.null")
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      setLoadingEquipe(false);

      if (error) {
        console.warn("Erro ao carregar equipe:", error.message);
        setEquipe([]);
        return;
      }

      const mapped: MembroEquipe[] = (data || []).map((m: any) => ({
        id: String(m.id),
        nome: m.nome || "",
        cargo: m.cargo || m.funcao || "",
        foto_url: m.foto_url || "",
        bio: m.bio ?? null,
        instagram: (m.instagram ?? "").toString() || null,
      }));

      setEquipe(mapped);
    })();
  }, []);

  const equipeAvatares = useMemo(() => equipe.filter((m) => !!m.foto_url).slice(0, 10), [equipe]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[#F2B705] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">Quem Somos</h1>
          <p className="text-xl text-white/90 leading-relaxed">
            Comunicação popular que nasce do coração do Território Kalunga
          </p>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-white"
          style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }}
        />
      </section>

      {/* Nossa História + Equipe (lado a lado) */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-10 text-center">Nossa História</h2>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Texto */}
            <div className="prose prose-lg max-w-none">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                A Rede Kalunga Comunicações (RKC) nasceu em 2020 como uma resposta à necessidade
                de dar voz e visibilidade às histórias, saberes e lutas das comunidades quilombolas
                da Chapada dos Veadeiros e do Território Kalunga.
              </p>

              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Somos uma mídia independente, criada e gerida por comunicadores populares,
                jornalistas comunitários e lideranças territoriais comprometidas com a valorização
                da cultura quilombola, a defesa dos direitos das comunidades tradicionais e a
                promoção do jornalismo ético e independente.
              </p>

              <p className="text-lg text-gray-700 leading-relaxed mb-0">
                Nosso trabalho se fundamenta na comunicação popular, entendendo que as próprias
                comunidades devem ser protagonistas de suas narrativas. Através de matérias,
                reportagens, projetos culturais e formativos, buscamos amplificar as vozes que
                historicamente foram silenciadas ou distorcidas pela mídia tradicional.
              </p>
            </div>

            {/* Card Equipe */}
            <div className="space-y-4">
              <RKCCard className="overflow-hidden">
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  {settings?.about_team_image_url ? (
                    <img
                      src={settings.about_team_image_url}
                      alt="Equipe RKC"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-black/10" />
                  )}

                  {equipeAvatares.length > 0 && (
                    <div className="absolute bottom-4 left-4 flex items-center">
                      {equipeAvatares.map((m, idx) => (
                        <div
                          key={m.id}
                          className="w-10 h-10 rounded-full overflow-hidden border-2 border-white bg-gray-100"
                          style={{ marginLeft: idx === 0 ? 0 : -10 }}
                          title={m.nome}
                        >
                          <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {equipe.length > equipeAvatares.length && (
                        <div
                          className="w-10 h-10 rounded-full border-2 border-white bg-black/60 text-white text-xs flex items-center justify-center"
                          style={{ marginLeft: -10 }}
                        >
                          +{equipe.length - equipeAvatares.length}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                </div>

                <RKCCardContent className="p-6">
                  <h3 className="font-bold text-xl text-[#2E2E2E] mb-2">
                    {settings?.about_team_title || "Nossa Equipe"}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {settings?.about_team_subtitle || "Conheça as pessoas que constroem a RKC no dia a dia."}
                  </p>

                  {loadingEquipe && <div className="text-sm text-gray-500">Carregando equipe...</div>}

                  {!loadingEquipe && equipe.length === 0 && (
                    <div className="text-sm text-gray-500">Nenhum membro cadastrado ainda.</div>
                  )}

                  {!loadingEquipe && equipe.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {equipe.map((m) => (
                        <div key={m.id} className="flex items-center gap-3">
                          {/* ✅ FOTO clicável (layout intacto) */}
                          <div
                            className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={() => setMembroModal(m)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setMembroModal(m);
                            }}
                            title="Ver detalhes"
                          >
                            {m.foto_url ? (
                              <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                sem foto
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            {/* ✅ NOME clicável */}
                            <p
                              className="font-semibold text-sm text-[#2E2E2E] truncate cursor-pointer hover:underline"
                              role="button"
                              tabIndex={0}
                              onClick={() => setMembroModal(m)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setMembroModal(m);
                              }}
                              title="Ver detalhes"
                            >
                              {m.nome}
                            </p>
                            <p className="text-xs text-gray-600 truncate">{m.cargo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </RKCCardContent>
              </RKCCard>

              <p className="text-xs text-gray-500">
                *Este bloco é editado no Admin &gt; Configurações &gt; “Quem Somos”.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-12 text-center">Nossos Valores</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {valores.map((valor, index) => {
              const Icon = valor.icon;
              return (
                <RKCCard key={index} className="text-center">
                  <RKCCardContent className="p-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-xl text-[#2E2E2E] mb-3">{valor.titulo}</h3>
                    <p className="text-gray-600 leading-relaxed">{valor.descricao}</p>
                  </RKCCardContent>
                </RKCCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-6">Faça parte dessa história</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Conheça nossos projetos, leia nossas matérias e entre em contato para colaborar
            com a comunicação popular quilombola.
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

      {/* ✅ MODAL POP-UP */}
      {membroModal && (
        <div
          className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setMembroModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMembroModal(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center"
              aria-label="Fechar"
              title="Fechar"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>

            <div className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-100 mb-4">
                  {membroModal.foto_url ? (
                    <img src={membroModal.foto_url} alt={membroModal.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      Sem foto
                    </div>
                  )}
                </div>

                <h3 className="text-2xl font-bold text-[#2E2E2E]">{membroModal.nome}</h3>
                <p className="mt-1 text-sm text-gray-600">{membroModal.cargo}</p>

                {(() => {
                  const ig = parseInstagram(membroModal.instagram);
                  if (!ig) return null;
                  return (
                    <a
                      className="mt-3 inline-flex items-center gap-2 text-sm text-pink-600 hover:underline"
                      href={ig.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Instagram className="h-4 w-4" />
                      {ig.label}
                    </a>
                  );
                })()}

                {!!membroModal.bio && (
                  <p className="mt-5 text-gray-600 leading-relaxed">{membroModal.bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
