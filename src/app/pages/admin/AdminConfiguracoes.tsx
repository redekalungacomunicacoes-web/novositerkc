import { useEffect, useRef, useState } from "react";
import { Save, Image as ImageIcon } from "lucide-react";
import { getSiteSettings, updateSiteSettings } from "@/lib/siteSettings";
import { uploadPublicImage } from "@/lib/siteUpload";

type AdminSettingsForm = {
  home_banner_image_url: string;
  home_banner_title: string;
  home_banner_subtitle: string;

  home_territory_image_url: string;
  home_territory_title: string;
  home_territory_subtitle: string;

  // Quem Somos
  about_team_image_url: string;
  about_team_title: string;
  about_team_subtitle: string;
};

type UploadKind = "banner" | "territory" | "about_team";

const BUCKET = "site";

// 🔥 evita cache quando você sobrescreve a mesma url/path
function withCacheBuster(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

export function AdminConfiguracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | UploadKind>(null);

  const bannerFileRef = useRef<HTMLInputElement | null>(null);
  const territoryFileRef = useRef<HTMLInputElement | null>(null);
  const aboutTeamFileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<AdminSettingsForm>({
    home_banner_image_url: "",
    home_banner_title: "",
    home_banner_subtitle: "",

    home_territory_image_url: "",
    home_territory_title: "",
    home_territory_subtitle: "",

    about_team_image_url: "",
    about_team_title: "",
    about_team_subtitle: "",
  });

  function setField<K extends keyof AdminSettingsForm>(key: K, value: AdminSettingsForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const s = await getSiteSettings();

        setForm((p) => ({
          ...p,
          home_banner_image_url: s.home_banner_image_url ?? "",
          home_banner_title: s.home_banner_title ?? "",
          home_banner_subtitle: s.home_banner_subtitle ?? "",

          home_territory_image_url: s.home_territory_image_url ?? "",
          home_territory_title: s.home_territory_title ?? "",
          home_territory_subtitle: s.home_territory_subtitle ?? "",

          about_team_image_url: s.about_team_image_url ?? "",
          about_team_title: s.about_team_title ?? "",
          about_team_subtitle: s.about_team_subtitle ?? "",
        }));
      } catch (e: any) {
        console.warn("Erro ao carregar settings (Admin Configurações):", e?.message || e);
        alert(e?.message || "Erro ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleUpload(kind: UploadKind, file?: File) {
    if (!file) return;

    try {
      setUploading(kind);

      const url =
        kind === "banner"
          ? await uploadPublicImage({ bucket: BUCKET, path: "home/banner/banner", file })
          : kind === "territory"
          ? await uploadPublicImage({ bucket: BUCKET, path: "home/territory/territory", file })
          : await uploadPublicImage({ bucket: BUCKET, path: "about/team/team", file });

      // ⚠️ Se você sobrescreve sempre o mesmo path, o browser pode cachear.
      const busted = withCacheBuster(url);

      if (kind === "banner") setField("home_banner_image_url", busted);
      if (kind === "territory") setField("home_territory_image_url", busted);
      if (kind === "about_team") setField("about_team_image_url", busted);
    } catch (e: any) {
      alert(e?.message || "Erro ao enviar imagem.");
    } finally {
      setUploading(null);
      if (kind === "banner" && bannerFileRef.current) bannerFileRef.current.value = "";
      if (kind === "territory" && territoryFileRef.current) territoryFileRef.current.value = "";
      if (kind === "about_team" && aboutTeamFileRef.current) aboutTeamFileRef.current.value = "";
    }
  }

  async function onSave() {
    try {
      setSaving(true);

      await updateSiteSettings({
        home_banner_image_url: form.home_banner_image_url || null,
        home_banner_title: form.home_banner_title || null,
        home_banner_subtitle: form.home_banner_subtitle || null,

        home_territory_image_url: form.home_territory_image_url || null,
        home_territory_title: form.home_territory_title || null,
        home_territory_subtitle: form.home_territory_subtitle || null,

        about_team_image_url: form.about_team_image_url || null,
        about_team_title: form.about_team_title || null,
        about_team_subtitle: form.about_team_subtitle || null,
      });

      alert("Configurações salvas!");
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie as informações gerais do site e preferências.</p>
      </div>

      <div className="grid gap-6">
        {/* General Info (mock) */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Informações Gerais</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Site</label>
              <input
                defaultValue="Rede Kalunga Comunicações"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email de Contato</label>
              <input
                defaultValue="contato@kalunga.org.br"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <input
                defaultValue="+55 (62) 99999-9999"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Endereço</label>
              <input
                defaultValue="Cavalcante - GO"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Social Media (mock) */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Redes Sociais</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Instagram</label>
              <input
                placeholder="@usuario"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Facebook</label>
              <input
                placeholder="facebook.com/pagina"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">YouTube</label>
              <input
                placeholder="youtube.com/canal"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Banner (Home) */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Banner (Home)</h3>

          <input
            ref={bannerFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload("banner", e.target.files?.[0])}
          />

          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10"
            onClick={() => {
              if (uploading === "banner") return;
              bannerFileRef.current?.click();
            }}
          >
            {form.home_banner_image_url ? (
              <div className="w-full">
                <img
                  src={form.home_banner_image_url}
                  alt="Banner da Home"
                  className="w-full h-40 object-cover rounded-md border bg-white"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Clique para {uploading === "banner" ? "enviar..." : "trocar a imagem do banner"}
                </p>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {uploading === "banner" ? "Enviando..." : "Enviar imagem do banner"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploading === "banner" ? "Aguarde" : "Clique para fazer upload"}
                </p>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Título do Banner</label>
              <input
                value={form.home_banner_title}
                onChange={(e) => setField("home_banner_title", e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Subtítulo do Banner</label>
              <input
                value={form.home_banner_subtitle}
                onChange={(e) => setField("home_banner_subtitle", e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">URL da imagem (opcional)</label>
              <input
                value={form.home_banner_image_url}
                onChange={(e) => setField("home_banner_image_url", e.target.value)}
                placeholder="https://..."
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Bloco acima do rodapé (Home) */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Bloco acima do rodapé (Home)</h3>

          <input
            ref={territoryFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload("territory", e.target.files?.[0])}
          />

          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10"
            onClick={() => {
              if (uploading === "territory") return;
              territoryFileRef.current?.click();
            }}
          >
            {form.home_territory_image_url ? (
              <div className="w-full">
                <img
                  src={form.home_territory_image_url}
                  alt="Imagem do bloco acima do rodapé"
                  className="w-full h-40 object-cover rounded-md border bg-white"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Clique para {uploading === "territory" ? "enviar..." : "trocar a imagem do bloco"}
                </p>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {uploading === "territory" ? "Enviando..." : "Enviar imagem do bloco"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploading === "territory" ? "Aguarde" : "Clique para fazer upload"}
                </p>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Título</label>
              <input
                value={form.home_territory_title}
                onChange={(e) => setField("home_territory_title", e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Subtítulo</label>
              <input
                value={form.home_territory_subtitle}
                onChange={(e) => setField("home_territory_subtitle", e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">URL da imagem (opcional)</label>
              <input
                value={form.home_territory_image_url}
                onChange={(e) => setField("home_territory_image_url", e.target.value)}
                placeholder="https://..."
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Quem Somos */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg border-b pb-4 mb-4">Quem Somos</h3>

          <input
            ref={aboutTeamFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleUpload("about_team", e.target.files?.[0])}
          />

          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10"
            onClick={() => {
              if (uploading === "about_team") return;
              aboutTeamFileRef.current?.click();
            }}
          >
            {form.about_team_image_url ? (
              <div className="w-full">
                <img
                  src={form.about_team_image_url}
                  alt="Imagem da Equipe (Quem Somos)"
                  className="w-full h-40 object-cover rounded-md border bg-white"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Clique para {uploading === "about_team" ? "enviar..." : "trocar a imagem"}
                </p>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {uploading === "about_team" ? "Enviando..." : "Enviar imagem da equipe"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploading === "about_team" ? "Aguarde" : "Clique para fazer upload"}
                </p>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Título</label>
              <input
                value={form.about_team_title}
                onChange={(e) => setField("about_team_title", e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Subtítulo</label>
              <input
                value={form.about_team_subtitle}
                onChange={(e) => setField("about_team_subtitle", e.target.value)}
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">URL da imagem (opcional)</label>
              <input
                value={form.about_team_image_url}
                onChange={(e) => setField("about_team_image_url", e.target.value)}
                placeholder="https://..."
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                disabled={loading}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            *A imagem é configurável, e os avatares/listagem vão espelhar automaticamente a equipe cadastrada.
          </p>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={onSave}
            disabled={saving || loading || !!uploading}
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
