import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Valor = {
  id: string;
  titulo: string;
  descricao: string | null;
  ordem: number | null;
};

export function AdminQuemSomos() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [historia, setHistoria] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");

  const [valores, setValores] = useState<Valor[]>([]);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  async function carregar() {
    setLoading(true);

    const { data: qs } = await supabase
      .from("quem_somos")
      .select("historia, imagem_url")
      .limit(1)
      .maybeSingle();

    if (qs) {
      setHistoria(qs.historia || "");
      setImagemUrl(qs.imagem_url || "");
    }

    const { data: vs } = await supabase
      .from("valores")
      .select("*")
      .order("ordem", { ascending: true });

    setValores((vs || []) as Valor[]);
    setLoading(false);
  }

  async function salvarQuemSomos() {
    setSaving(true);

    // garante 1 registro: upsert por id fixo
    const ID_FIXO = "00000000-0000-0000-0000-000000000001";

    await supabase.from("quem_somos").upsert({
      id: ID_FIXO,
      historia,
      imagem_url: imagemUrl,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    alert("Quem Somos salvo!");
  }

  async function adicionarValor() {
    if (!novoTitulo.trim()) return;

    const nextOrder = (valores[valores.length - 1]?.ordem ?? valores.length) + 1;

    const { data, error } = await supabase
      .from("valores")
      .insert({
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim() || null,
        ordem: nextOrder,
      })
      .select("*")
      .single();

    if (error) {
      alert("Erro ao adicionar valor");
      return;
    }

    setValores((prev) => [...prev, data as Valor]);
    setNovoTitulo("");
    setNovaDescricao("");
  }

  async function removerValor(id: string) {
    const ok = confirm("Remover este valor?");
    if (!ok) return;

    await supabase.from("valores").delete().eq("id", id);
    setValores((prev) => prev.filter((v) => v.id !== id));
  }

  useEffect(() => {
    carregar();
  }, []);

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold">Quem Somos</h1>
        <p className="text-sm text-muted-foreground">
          Configure a história, imagem principal e os valores.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Nossa História</h2>
        <textarea
          value={historia}
          onChange={(e) => setHistoria(e.target.value)}
          rows={10}
          className="w-full rounded-md border p-3 bg-background"
          placeholder="Digite aqui o texto principal da nossa história..."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Imagem Principal (URL)</h2>
        <input
          value={imagemUrl}
          onChange={(e) => setImagemUrl(e.target.value)}
          className="w-full rounded-md border p-3 bg-background"
          placeholder="Cole a URL da imagem do Supabase Storage ou externa"
        />
        {imagemUrl ? (
          <img src={imagemUrl} alt="Preview" className="max-w-xl rounded-md border" />
        ) : null}
      </section>

      <div>
        <button
          onClick={salvarQuemSomos}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar Quem Somos"}
        </button>
      </div>

      <hr className="border-border" />

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Nossos Valores</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            className="w-full rounded-md border p-3 bg-background"
            placeholder="Título do valor (ex: Respeito)"
          />
          <input
            value={novaDescricao}
            onChange={(e) => setNovaDescricao(e.target.value)}
            className="w-full rounded-md border p-3 bg-background"
            placeholder="Descrição (opcional)"
          />
        </div>

        <button
          onClick={adicionarValor}
          className="px-4 py-2 rounded-md border hover:bg-muted"
        >
          Adicionar valor
        </button>

        <div className="space-y-2">
          {valores.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-4 rounded-md border p-4">
              <div>
                <div className="font-semibold">{v.titulo}</div>
                {v.descricao ? <div className="text-sm text-muted-foreground">{v.descricao}</div> : null}
              </div>

              <button
                onClick={() => removerValor(v.id)}
                className="text-sm text-destructive hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
