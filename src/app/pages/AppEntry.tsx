import { ArrowRight, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { RkcLogo } from "@/app/components/RkcLogo";

export function AppEntry() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#f5f6ef] px-5 py-8">
      <section className="w-full max-w-md" aria-labelledby="app-entry-title">
        <header className="mb-8 text-center">
          <RkcLogo className="mx-auto mb-4 h-20 w-auto max-w-full" />
          <p className="text-sm font-semibold tracking-wide text-[#376b4d]">
            REDE KALUNGA COMUNICAÇÕES
          </p>
          <h1 id="app-entry-title" className="mt-3 text-2xl font-bold leading-tight text-[#202820] sm:text-3xl">
            Bem-vindo à RKC
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#5e685f]">
            Acompanhe matérias, projetos e histórias do Território Kalunga.
          </p>
        </header>

        <nav className="flex flex-col items-center" aria-label="Acessos do aplicativo">
          <Link
            to="/"
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#28633f] px-6 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-[#205333] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28633f] focus-visible:ring-offset-2"
          >
            Entrar
            <ArrowRight aria-hidden="true" size={20} />
          </Link>

          <Link
            to="/admin"
            className="mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#647164] transition hover:text-[#28633f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#28633f] focus-visible:ring-offset-2"
          >
            <UsersRound aria-hidden="true" size={16} />
            Área da equipe
          </Link>
        </nav>

        <p className="mt-7 text-center text-xs text-[#778078]">
          Acesso interno restrito às pessoas da equipe RKC.
        </p>
      </section>
    </main>
  );
}
