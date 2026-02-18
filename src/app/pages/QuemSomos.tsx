import { useState } from "react";
import { X, Instagram } from "lucide-react";

type Integrante = {
  id: string;
  nome: string;
  cargo: string;
  foto: string;
  instagram: string;
  bio: string;
};

const equipe: Integrante[] = [
  {
    id: "1",
    nome: "Thiago Dias",
    cargo: "Desenvolvedor Full Stack",
    foto: "/images/thiago.jpg",
    instagram: "thiagodias.dev",
    bio: "Responsável pelo desenvolvimento da plataforma, arquitetura do sistema e integração com banco de dados."
  },
  {
    id: "2",
    nome: "Felipe",
    cargo: "Front-end",
    foto: "/images/felipe.jpg",
    instagram: "felipe.design",
    bio: "Responsável pela construção das interfaces visuais e experiência do usuário."
  }
];

export default function QuemSomos() {
  const [selecionado, setSelecionado] = useState<Integrante | null>(null);

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-bold text-center mb-12">Quem Somos</h2>

      {/* GRID EQUIPE */}
      <div className="grid md:grid-cols-3 gap-8">
        {equipe.map((membro) => (
          <div
            key={membro.id}
            onClick={() => setSelecionado(membro)}
            className="cursor-pointer bg-white rounded-xl shadow-md hover:shadow-xl transition p-6 text-center"
          >
            <img
              src={membro.foto}
              alt={membro.nome}
              className="w-28 h-28 mx-auto rounded-full object-cover mb-4"
            />
            <h3 className="text-lg font-semibold">{membro.nome}</h3>
            <p className="text-amber-600">{membro.cargo}</p>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {selecionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-fadeIn">

            {/* BOTÃO FECHAR */}
            <button
              onClick={() => setSelecionado(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-black"
            >
              <X size={24} />
            </button>

            {/* FOTO */}
            <img
              src={selecionado.foto}
              alt={selecionado.nome}
              className="w-32 h-32 mx-auto rounded-full object-cover mb-6"
            />

            {/* NOME */}
            <h3 className="text-2xl font-bold text-center mb-2">
              {selecionado.nome}
            </h3>

            {/* CARGO */}
            <p className="text-center text-amber-600 font-medium mb-4">
              {selecionado.cargo}
            </p>

            {/* INSTAGRAM */}
            <div className="flex justify-center mb-4">
              <a
                href={`https://instagram.com/${selecionado.instagram}`}
                target="_blank"
                className="flex items-center gap-2 text-pink-600 hover:underline"
              >
                <Instagram size={18} />
                @{selecionado.instagram}
              </a>
            </div>

            {/* BIO */}
            <p className="text-gray-600 text-center leading-relaxed">
              {selecionado.bio}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
