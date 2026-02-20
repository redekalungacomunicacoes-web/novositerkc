"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminQuemSomos() {
  const [historia, setHistoria] = useState("");
  const [imagem, setImagem] = useState("");
  const [valores, setValores] = useState([]);
  const [loading, setLoading] = useState(false);

  async function carregarDados() {
    const { data } = await supabase
      .from("quem_somos")
      .select("*")
      .single();

    if (data) {
      setHistoria(data.historia || "");
      setImagem(data.imagem_url || "");
    }

    const { data: valoresData } = await supabase
      .from("valores")
      .select("*")
      .order("ordem");

    if (valoresData) setValores(valoresData);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function salvar() {
    setLoading(true);

    await supabase.from("quem_somos").upsert({
      id: "00000000-0000-0000-0000-000000000001",
      historia: historia,
      imagem_url: imagem
    });

    setLoading(false);
    alert("Salvo com sucesso!");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurar Página Quem Somos</h1>

      <div>
        <label>História</label>
        <textarea
          value={historia}
          onChange={(e) => setHistoria(e.target.value)}
          className="w-full border p-3 rounded"
          rows={8}
        />
      </div>

      <div>
        <label>Imagem Principal (URL)</label>
        <input
          value={imagem}
          onChange={(e) => setImagem(e.target.value)}
          className="w-full border p-3 rounded"
        />
      </div>

      <button
        onClick={salvar}
        className="bg-green-600 text-white px-6 py-2 rounded"
      >
        {loading ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
