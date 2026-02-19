import { useEffect, useRef, useState } from "react";
import { Save, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { getSiteSettings, updateSiteSettings } from "@/lib/siteSettings";
import { uploadPublicImage } from "@/lib/siteUpload";

interface Valor {
  id: number;
  titulo: string;
  descricao: string;
}

const VALORES_DEFAULT: Valor[] = [
  { id: 1, titulo: "Pertencimento", descricao: "Enraizamento territorial e valorização da identidade quilombola" },
  { id: 2, titulo: "Comunidade", descricao: "Comunicação feita pela e para as comunidades do território quilombola" },
  { id: 3, titulo: "Autonomia", descricao: "Jornalismo independente e livre de interesses comerciais" },
  { id: 4, titulo: "Amplificação", descricao: "Dar voz e visibilidade às narrativas do território quilombola" },
];

const BUCKET = "site";

function withCacheBuster(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

export function AdminQuemSomos() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const aboutTeamFileRef = useRef<HTMLInputElement | null>(null);

  const [imagemUrl, setImagemUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [valores, setValores] = useState<Valor[]>(VALORES_DEFAULT);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const s = await getSiteSettings();
        setImagemUrl(s.about_team_image_url ?? "");
        setTitulo(s.about_team_title ?? "");
        setSubtitulo(s.about_team_subtitle ?? "");
        if (s.quem_somos_valores) {
          try {
            const parsed = JSON.parse(s.quem_somos_valores);
            if (Array.isArray(parsed) && parsed.length > 0) setValores(parsed);
          } catch {}
        }
      } catch (e: any) {
        alert(e?.message || "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleUpload(file?: File) {
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadPublicImage({ bucket: BUCKET, path: "about/team/team", file });
      setImagemUrl(withCacheBuster(url));
    } catch (e: any) {
      alert(e?.message || "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
      if (aboutTeamFileRef.current) aboutTeamFileRef.current.value = "";
    }
  }

  const handleValorChange = (id: number, field: keyof Omit<Valor, "id">, value: string) => {
    setValores((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const handleAddValor = () => {
    setValores((prev) => [...prev, { id: Date.now(), titulo: "", descricao: "" }]);
  };

  const handleRemoveValor = (id: number) => {
    setValores((prev) => prev.filter((v) => v.id !== id));
  };

  async function onSave() {
    try {
      setSaving(true);
      await updateSiteSettings({
        about_team_image_url: imagemUrl || null,
        about_team_title: titulo || null,
        about_team_subtitle: subtitulo || null,
        quem_somos_valores: JSON.stringify(valores),
      } as any);
      alert("Salvo com sucesso!");
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quem Somos</h1>
          <p className="text-muted-foreground mt-1">Gerencie o conteúdo público da página institucional.</p>
        </div>
        <button
          onClick={onSave}
          disabled={saving || loading || uploading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : uploading ? "Enviando..." : "Salvar Alterações"}
        </button>
      </div>

      <div className="grid gap-6">

        {/* Bloco 1: Nossa História */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Nossa História</h3>

          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Nossa Equipe"
              className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Subtítulo</label>
            <input
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex: Uma mídia independente construída coletivamente..."
              className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Aparece centralizado abaixo do título "Nossa História" na página pública.
            </p>
          </div>
        </div>

        {/* Bloco 2: Imagem da Equipe */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Imagem Principal da Equipe</h3>

          <input
            ref={aboutTeamFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />

          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10"
            onClick={() => { if (!uploading) aboutTeamFileRef.current?.click(); }}
          >
            {imagemUrl ? (
              <div className="w-full">
                <img
                  src={imagemUrl}
                  alt="Imagem da Equipe (Quem Somos)"
                  className="w-full h-40 object-cover rounded-md border bg-white"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Clique para {uploading ? "enviar..." : "trocar a imagem"}
                </p>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">{uploading ? "Enviando..." : "Enviar imagem da equipe"}</p>
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
              disabled={loading}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            *A imagem é configurável, e os avatares/listagem vão espelhar automaticamente a equipe cadastrada.
          </p>
        </div>

        {/* Bloco 3: Nossos Valores */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h3 className="font-semibold text-lg">Nossos Valores</h3>
            <button
              type="button"
              onClick={handleAddValor}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Valor
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            Estes valores aparecem na seção "Nossos Valores" da página pública.
          </p>

          <div className="space-y-4">
            {valores.map((valor, index) => (
              <div key={valor.id} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Valor {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveValor(valor.id)}
                    className="p-1.5 hover:bg-muted rounded-full text-red-500 hover:text-red-600 transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Título</label>
                  <input
                    value={valor.titulo}
                    onChange={(e) => handleValorChange(valor.id, "titulo", e.target.value)}
                    placeholder="Ex: Pertencimento"
                    className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <textarea
                    value={valor.descricao}
                    onChange={(e) => handleValorChange(valor.id, "descricao", e.target.value)}
                    placeholder="Ex: Enraizamento territorial e valorização da identidade quilombola"
                    rows={2}
                    className="w-full p-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm resize-none"
                  />
                </div>
              </div>
            ))}

            {valores.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum valor cadastrado. Clique em "Adicionar Valor" para começar.
              </p>
            )}
          </div>
        </div>

        {/* Botão salvar rodapé */}
        <div className="flex justify-end pb-8">
          <button
            onClick={onSave}
            disabled={saving || loading || uploading}
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
