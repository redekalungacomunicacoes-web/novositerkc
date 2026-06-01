import { Wrench, Clock, ShieldCheck } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center px-6">
      <div className="max-w-4xl text-center">

        <div className="mb-8">
          <img
            src="/logo-rkc.png"
            alt="Rede Kalunga Comunicações"
            className="w-40 mx-auto mb-6"
          />
        </div>

        <div className="inline-flex p-5 rounded-full border border-yellow-500/20 bg-yellow-500/10 mb-8">
          <Wrench className="w-14 h-14 text-yellow-400" />
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          Plataforma em Manutenção
        </h1>

        <p className="text-slate-300 text-xl max-w-3xl mx-auto leading-relaxed mb-10">
          Estamos realizando melhorias em nossa infraestrutura para oferecer uma
          experiência mais rápida, segura e estável.
        </p>

        <div className="w-full max-w-xl mx-auto mb-10">
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-yellow-500 animate-pulse"></div>
          </div>
          <p className="text-slate-400 mt-3">
            Atualização em andamento...
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-10">

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold text-lg">
              Previsão de Retorno
            </h3>
            <p className="text-slate-400">
              Até 24 horas
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <ShieldCheck className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold text-lg">
              Atualização Segura
            </h3>
            <p className="text-slate-400">
              Sistema sendo otimizado
            </p>
          </div>

        </div>

        <p className="text-slate-500 text-sm">
          © 2026 Rede Kalunga Comunicações
        </p>

      </div>
    </div>
  );
}
