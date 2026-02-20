import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadPublicImage } from "@/lib/siteUpload";

type Valor = {
  id: string;
  titulo: string;
  descricao: string | null;
  ordem: number | null;
};

const BUCKET = "site";

// ✅ seu id é INTEGER no banco
const QUEM_SOMOS_ID = 1;

function withCacheBuster(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

export function AdminQuemSomos() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const imageFileRef = useRef<HTMLInputElement | null>(null);

  const [historia, setHistoria] = useState("");
  const [missao, setMissao] = useState("");
  const [visao, setVisao] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");

  const [valores, setValores] = useState<Valor[]>([]);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  const valoresOrdenados = useMemo(() => {
    return [...valores].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }, [valores]);

  async function carregar() {
    try {
      setLoading(true);

      // ✅ pega sempre id=1
      const { data: qs, error: qsErr } = await supabase
        .from("quem_somos")
        .select("id, historia, missao, visao, imagem_url")
        .eq("id", QUEM_SOMOS_ID)
        .maybeSingle();

      if (qsErr) throw qsErr;

      if (qs) {
        setHistoria(qs.historia || "");
        setMissao(qs.missao || "");
        setVisao(qs.visao || "");
        setImagemUrl(qs.imagem_url || "");
      }

      const { data: vs, error: vsErr } = await supabase
        .from("valores")
        .select("*")
        .order("ordem", { ascending: true });

      if (vsErr) throw vsErr;

      setValores((vs || []) as Valor[]);
    } catch (e: any) {
      console.warn("Erro ao carregar Quem Somos:", e?.message || e);
      alert(e?.message || "Erro ao carregar Quem Somos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleUpload(file?: File) {
    if (!file) return;

    try {
      setUploading(true);

      const url = await uploadPublicImage({
        bucket: BUCKET,
        path: "quem-somos/imagem-principal/imagem",
        file,
      });

      setImagemUrl(withCacheBuster(url));
    } catch (e: any) {
      alert(e?.message || "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = "";
    }
  }

  async function salvarQuemSomos() {
    try {
      setSaving(true);

      const { error } = await supabase.from("quem_somos").upsert({
        id: QUEM_SOMOS_ID,
        historia: historia || null,
        missao: missao || null,
        visao: visao || null,
        imagem_url: imagemUrl || null,
      });

      if (error) throw error;

      alert("Quem Somos salvo!");
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar Quem Somos.");
    } finally {
      setSaving(false);
    }
  }

  async function adicionarValor() {
    const titulo = novoTitulo.trim();
    const descricao = novaDescricao.trim();

    if (!titulo) return alert("Informe o título do valor.");

    try {
      const nextOrder =
        (valoresOrdenados[valoresOrdenados.length - 1]?.ordem ?? valoresOrdenados.length) + 1;

      const { data, error } = await supabase
        .from("valores")
        .insert({
          titulo,
          descricao: descricao || null,
          ordem: nextOrder,
        })
        .select("*")
        .single();

      if (error) throw error;

      setValores((prev) => [...prev, data as Valor]);
      setNovoTitulo("");
      setNovaDescricao("");
    } catch (e: any) {
      alert(e?.message || "Erro ao adicionar valor.");
    }
  }

  async function removerValor(id: string) {
    const ok = confirm("Remover este valor?");
    if (!ok) return;

    try {
      const { error } = await supabase.from("valores").delete().eq("id", id);
      if (error) throw error;

      setValores((prev) => prev.filter((v) => v.id !== id));
    } catch (e: any) {
      alert(e?.message || "Erro ao remover valor.");
    }
  }

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quem Somos</h1>
        <p className="text-muted-foreground mt-1">
          Configure a história, imagem principal, missão, visão e valores.
        </p>
      </div>

      <div className="grid gap-6">
        {/* História */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Nossa História</h3>
          <textarea
            value={historia}
            onChange={(e) => setHistoria(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            placeholder="Digite aqui a história..."
          />
        </div>

        {/* Missão e Visão */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Missão e Visão</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Missão</label>
              <textarea
                value={missao}
                onChange={(e) => setMissao(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Digite a missão..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visão</label>
              <textarea
                value={visao}
                onChange={(e) => setVisao(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Digite a visão..."
              />
            </div>
          </div>
        </div>

        {/* Imagem principal */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Imagem Principal</h3>

          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />

          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10"
            onClick={() => {
              if (uploading) return;
              imageFileRef.current?.click();
            }}
          >
            {imagemUrl ? (
              <div className="w-full">
                <img
                  src={imagemUrl}
                  alt="Imagem principal"
                  className="w-full h-52 object-cover rounded-md border bg-white"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Clique para {uploading ? "enviar..." : "trocar a imagem"}
                </p>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">{uploading ? "Enviando..." : "Enviar imagem principal"}</p>
                <p className="text-xs text-muted-foreground mt-1">{uploading ? "Aguarde" : "Clique para fazer upload"}</p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">URL da imagem (opcional)</label>
            <input
              value={imagemUrl}
              onChange={(e) => setImagemUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              disabled={uploading}
            />
          </div>
        </div>

        {/* Valores */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Nossos Valores</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <input
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Ex: Respeito"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <input
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="Opcional"
              />
            </div>
          </div>

          <button
            onClick={adicionarValor}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar valor
          </button>

          <div className="space-y-2">
            {valoresOrdenados.length ? (
              valoresOrdenados.map((v) => (
                <div key={v.id} className="flex items-start justify-between gap-4 rounded-md border p-4">
                  <div>
                    <div className="font-semibold">{v.titulo}</div>
                    {v.descricao ? <div className="text-sm text-muted-foreground">{v.descricao}</div> : null}
                  </div>

                  <button
                    onClick={() => removerValor(v.id)}
                    className="inline-flex items-center gap-2 text-sm text-destructive hover:bg-destructive/10 px-3 py-2 rounded-md transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum valor cadastrado ainda.</p>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={salvarQuemSomos}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : uploading ? "Enviando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
