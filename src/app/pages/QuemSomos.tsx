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
  instagram?: string;
  bio?: string;
};

export function QuemSomos() {
  const valores = [
    { icon: Heart, titulo: "Pertencimento", descricao: "Enraizamento territorial e valorização da identidade quilombola" },
    { icon: Users, titulo: "Comunidade", descricao: "Comunicação feita pela e para as comunidades do território" },
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

      // ⚠️ Se seus campos tiverem outro nome, me diga o nome exato da coluna no Supabase.
      const { data, error } = await supabase
        .from("equipe")
        .select("id, nome, cargo, foto_url, instagram, bio, ordem, ativo")
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
        instagram: (m.instagram || "").replace(/^@/, ""),
        bio: m.bio || "",
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
            Comunicação feita pela e para as comunidades do território.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <RKCButton asChild size="lg" className="bg-[#F2B705] text-black hover:bg-[#F2B705]/90">
              <Link to="/contato">
                Fale com a gente <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </RKCButton>
            <RKCButton asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <Link to="/projetos">Ver Projetos</Link>
            </RKCButton>
          </div>
        </div>
      </section>

      {/* Exemplo de bloco existente que usa avatares (mantive) */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <RKCCard className="relative overflow-hidden">
            <RKCCardContent className="p-8 md:p-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {settings?.site_title || "Nossa História"}
              </h2>
              <p className="text-gray-600 max-w-3xl">
                {settings?.site_description || "Um projeto de comunicação com identidade e território."}
              </p>

              {equipeAvatares.length > 0 && (
                <div className="mt-6 flex items-center">
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
                  <span className="ml-3 text-sm text-gray-500">Equipe</span>
                </div>
              )}
            </RKCCardContent>
          </RKCCard>
        </div>
      </section>

      {/* Team block dentro do seu card (layout preservado) */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-4">
                {settings?.about_title || "Sobre Nós"}
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {settings?.about_text || "Conteúdo institucional editável no Admin."}
              </p>
            </div>

            <div className="space-y-4">
              <RKCCard className="overflow-hidden">
                <div className="relative h-40 bg-gradient-to-br from-[#0F7A3E] to-[#2FA866]">
                  {equipeAvatares.length > 0 && (
                    <div className="absolute bottom-4 left-6 flex items-center">
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
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMembroModal(m)}
                          className="flex items-center gap-3 text-left group"
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            {m.foto_url ? (
                              <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                sem foto
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-[#2E2E2E] truncate group-hover:underline">
                              {m.nome}
                            </p>
                            <p className="text-xs text-gray-600 truncate">{m.cargo}</p>
                          </div>
                        </button>
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
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] text-center mb-12">
            Nossos valores
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {valores.map((v, i) => {
              const Icon = v.icon;
              return (
                <RKCCard key={i} className="h-full">
                  <RKCCardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#0F7A3E]/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-[#0F7A3E]" />
                    </div>
                    <h3 className="font-semibold text-gray-900">{v.titulo}</h3>
                    <p className="mt-2 text-sm text-gray-600">{v.descricao}</p>
                  </RKCCardContent>
                </RKCCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modal Integrante (janela pop-up) */}
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

                {membroModal.instagram && (
                  <a
                    className="mt-3 inline-flex items-center gap-2 text-sm text-pink-600 hover:underline"
                    href={`https://instagram.com/${membroModal.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Instagram className="h-4 w-4" />
                    @{membroModal.instagram}
                  </a>
                )}

                {membroModal.bio && (
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
