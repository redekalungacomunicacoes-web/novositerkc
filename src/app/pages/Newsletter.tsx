import { useState } from "react";
import { RKCButton } from "@/app/components/RKCButton";
import { RKCCard, RKCCardContent } from "@/app/components/RKCCard";
import { Mail, CheckCircle2, Newspaper, Calendar, Bell, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMsg(null);
    setLoading(true);

    const payload = {
      email: email.trim(),
      name: nome.trim(),
      // Você pode enviar um "source" se quiser rastrear:
      source: "site_newsletter_page",
    };

    try {
      // ✅ Preferido: Edge Function (envio/validação centralizada)
      const { error } = await supabase.functions.invoke("newsletter-subscribe", {
        body: payload,
      });

      if (error) {
        // Mensagens mais amigáveis
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("duplicate") || msg.includes("already") || msg.includes("unique")) {
          setSubscribed(true);
          setEmail("");
          setNome("");
          setLoading(false);
          return;
        }
        setErrorMsg("Não foi possível concluir sua inscrição agora. Tente novamente em instantes.");
        setLoading(false);
        return;
      }

      setSubscribed(true);
      setEmail("");
      setNome("");
      setLoading(false);
    } catch (err) {
      // 🔁 Fallback (opcional): inserir direto na tabela (se você preferir)
      // const { error: insertErr } = await supabase.from("newsletter_subscribers").upsert(
      //   { email: payload.email, name: payload.name, status: "active" },
      //   { onConflict: "email" }
      // );
      // if (insertErr) { ... }

      setErrorMsg("Erro inesperado ao inscrever. Verifique sua conexão e tente novamente.");
      setLoading(false);
    }
  };

  const beneficios = [
    {
      icon: Newspaper,
      titulo: "Matérias Exclusivas",
      descricao: "Receba em primeira mão nossas reportagens e conteúdos especiais",
    },
    {
      icon: Calendar,
      titulo: "Agenda Cultural",
      descricao: "Fique por dentro dos eventos e atividades no território",
    },
    {
      icon: Bell,
      titulo: "Atualizações",
      descricao: "Novidades sobre projetos e iniciativas da RKC",
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 bg-gradient-to-br from-[#F2B705] to-[#C85A1E] overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[#0F7A3E] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">Newsletter RKC</h1>
          <p className="text-xl text-white/90 leading-relaxed max-w-2xl mx-auto">
            Receba as histórias, projetos e transformações do Território Kalunga diretamente no seu email
          </p>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-white"
          style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }}
        />
      </section>

      {/* Formulário de Inscrição */}
      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {!subscribed ? (
            <RKCCard className="border-2 border-[#0F7A3E]">
              <RKCCardContent className="p-8 md:p-12">
                <h2 className="text-3xl font-bold text-[#2E2E2E] mb-4 text-center">Assine nossa Newsletter</h2>
                <p className="text-gray-600 mb-8 text-center">
                  Preencha os dados abaixo e faça parte da nossa comunidade
                </p>

                {/* Erro (sem quebrar layout) */}
                {errorMsg && (
                  <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 mt-0.5" />
                    <div>{errorMsg}</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="nome" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                      Seu nome
                    </label>
                    <input
                      type="text"
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F7A3E] focus:border-transparent disabled:opacity-70"
                      placeholder="Digite seu nome"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-[#2E2E2E] mb-2">
                      Seu email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0F7A3E] focus:border-transparent disabled:opacity-70"
                      placeholder="seuemail@exemplo.com"
                    />
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consent"
                      required
                      disabled={loading}
                      className="mt-1 w-4 h-4 text-[#0F7A3E] border-gray-300 rounded focus:ring-[#0F7A3E] disabled:opacity-70"
                    />
                    <label htmlFor="consent" className="text-sm text-gray-600">
                      Concordo em receber emails da Rede Kalunga Comunicações e entendo que posso cancelar a inscrição a
                      qualquer momento.
                    </label>
                  </div>

                  <RKCButton type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (
                      <>
                        Inscrevendo...
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </>
                    ) : (
                      <>
                        Assinar Newsletter
                        <Mail className="w-5 h-5" />
                      </>
                    )}
                  </RKCButton>
                </form>
              </RKCCardContent>
            </RKCCard>
          ) : (
            <RKCCard className="border-2 border-[#0F7A3E]">
              <RKCCardContent className="p-8 md:p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#0F7A3E]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-[#0F7A3E]" />
                </div>
                <h2 className="text-3xl font-bold text-[#2E2E2E] mb-4">Inscrição realizada!</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Obrigado por se inscrever na nossa newsletter. Em breve você receberá nossas histórias e novidades no
                  seu email.
                </p>
                <p className="text-sm text-gray-500">Não esqueça de verificar sua caixa de spam ou promoções.</p>
              </RKCCardContent>
            </RKCCard>
          )}
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#2E2E2E] mb-12 text-center">O que você vai receber</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {beneficios.map((beneficio, index) => {
              const Icon = beneficio.icon;
              return (
                <RKCCard key={index} className="text-center">
                  <RKCCardContent className="p-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#F2B705] to-[#C85A1E] flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-xl text-[#2E2E2E] mb-3">{beneficio.titulo}</h3>
                    <p className="text-gray-600 leading-relaxed">{beneficio.descricao}</p>
                  </RKCCardContent>
                </RKCCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* Frequência */}
      <section className="py-16 md:py-20 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#0F7A3E]/5 to-[#2FA866]/5 rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-[#2E2E2E] mb-6 text-center">Quando você receberá</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6 text-center">
              Nossa newsletter é enviada <strong>quinzenalmente</strong>, sempre trazendo o melhor do jornalismo
              comunitário do Território Kalunga.
            </p>
            <p className="text-gray-600 text-center">
              Respeitamos sua privacidade e você pode cancelar a inscrição a qualquer momento.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
