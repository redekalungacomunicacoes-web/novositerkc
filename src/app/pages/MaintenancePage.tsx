import { Settings, MessageCircle, Headphones } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-4xl">

        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 md:p-14 text-center">

          {/* Logo */}
          <img
            src="/RKCZ.png"
            alt="Rede Kalunga Comunicações"
            className="h-24 md:h-28 mx-auto mb-8 object-contain"
          />

          {/* Ícone */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
              <Settings
                size={48}
                className="text-green-600 animate-spin"
                style={{ animationDuration: "8s" }}
              />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6">
            Plataforma em Atualização
          </h1>

          {/* Texto */}
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-4">
            Estamos realizando melhorias em nossa infraestrutura digital para
            oferecer uma experiência mais rápida, segura e estável.
          </p>

          <p className="text-slate-500 mb-10">
            Nossa equipe trabalha para restabelecer todos os serviços o mais
            breve possível.
          </p>

          {/* Status */}
          <div className="inline-flex items-center gap-3 bg-green-50 border border-green-200 px-6 py-3 rounded-full mb-10">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span className="font-medium text-green-700">
              Atualização em andamento
            </span>
          </div>

          {/* Botões */}
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">

            <a
              href="https://wa.me/556298345609?text=Olá,%20gostaria%20de%20informações%20sobre%20o%20processo%20de%20inscrição."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <MessageCircle size={22} />
              Falar com a Equipe RKC
            </a>

            <a
              href="https://wa.me/5562993241277?text=Olá,%20estou%20entrando%20em%20contato%20sobre%20a%20manutenção%20da%20plataforma."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 border-2 border-green-600 text-green-700 hover:bg-green-50 px-6 py-4 rounded-xl font-semibold transition-all duration-300"
            >
              <Headphones size={22} />
              Suporte Técnico
            </a>

          </div>

          {/* Rodapé */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              © 2026 Rede Kalunga Comunicações
            </p>

            <p className="text-sm text-slate-400 mt-2">
              Agradecemos sua compreensão.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
