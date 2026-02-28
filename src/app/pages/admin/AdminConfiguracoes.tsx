import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSiteSettings, updateSiteSettings } from "@/lib/siteSettings";
import { uploadPublicImage } from "@/lib/siteUpload";
import {
  FOOTER_DESCRIPTION_MAX_CHARS,
  buildPublicStorageUrl,
  getFooterSettings,
  isLikelyUrl,
  isValidEmail,
  upsertFooterSettings,
  uploadFavicon,
  uploadFooterLogo,
} from "@/lib/footerSettings";

type AdminSettingsForm = {
  home_banner_image_url: string;
  home_banner_title: string;
  home_banner_subtitle: string;

  home_territory_image_url: string;
  home_territory_title: string;
  home_territory_subtitle: string;

  footer_logo_path: string;
  favicon_path: string;
  footer_description: string;
  footer_email: string;
  footer_instagram_url: string;
  footer_whatsapp: string;
  footer_facebook_url: string;
  footer_linkedin_url: string;
  footer_youtube_url: string;
  footer_location: string;
  footer_address_short: string;
  footer_maps_url: string;
};

type UploadKind = "banner" | "territory" | "footer-logo" | "favicon";

const BUCKET = "site";

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
  const footerLogoFileRef = useRef<HTMLInputElement | null>(null);
  const faviconFileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<AdminSettingsForm>({
    home_banner_image_url: "",
    home_banner_title: "",
    home_banner_subtitle: "",

    home_territory_image_url: "",
    home_territory_title: "",
    home_territory_subtitle: "",

    footer_logo_path: "",
    favicon_path: "",
    footer_description: "",
    footer_email: "",
    footer_instagram_url: "",
    footer_whatsapp: "",
    footer_facebook_url: "",
    footer_linkedin_url: "",
    footer_youtube_url: "",
    footer_location: "",
    footer_address_short: "",
    footer_maps_url: "",
  });

  const footerDescriptionCount = form.footer_description.length;

  const urlWarnings = useMemo(
    () => ({
      footer_instagram_url: !isLikelyUrl(form.footer_instagram_url),
      footer_facebook_url: !isLikelyUrl(form.footer_facebook_url),
      footer_linkedin_url: !isLikelyUrl(form.footer_linkedin_url),
      footer_youtube_url: !isLikelyUrl(form.footer_youtube_url),
      footer_maps_url: !isLikelyUrl(form.footer_maps_url),
      footer_whatsapp: Boolean(form.footer_whatsapp.trim()) && !isLikelyUrl(form.footer_whatsapp) && !/\d{8,}/.test(form.footer_whatsapp),
    }),
    [form]
  );

  function setField<K extends keyof AdminSettingsForm>(key: K, value: AdminSettingsForm[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [s, footer] = await Promise.all([getSiteSettings(), getFooterSettings()]);

        setForm((p) => ({
          ...p,
          home_banner_image_url: s.home_banner_image_url ?? "",
          home_banner_title: s.home_banner_title ?? "",
          home_banner_subtitle: s.home_banner_subtitle ?? "",

          home_territory_image_url: s.home_territory_image_url ?? "",
          home_territory_title: s.home_territory_title ?? "",
          home_territory_subtitle: s.home_territory_subtitle ?? "",

          footer_logo_path: footer.footer_logo_path ?? "",
          favicon_path: footer.favicon_path ?? "",
          footer_description: footer.footer_description ?? "",
          footer_email: footer.footer_email ?? "",
          footer_instagram_url: footer.footer_instagram_url ?? "",
          footer_whatsapp: footer.footer_whatsapp ?? "",
          footer_facebook_url: footer.footer_facebook_url ?? "",
          footer_linkedin_url: footer.footer_linkedin_url ?? "",
          footer_youtube_url: footer.footer_youtube_url ?? "",
          footer_location: footer.footer_location ?? "",
          footer_address_short: footer.footer_address_short ?? "",
          footer_maps_url: footer.footer_maps_url ?? "",
        }));
      } catch (e: any) {
        console.warn("Erro ao carregar settings (Admin Configurações):", e?.message || e);
        toast.error(e?.message || "Erro ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleUpload(kind: UploadKind, file?: File) {
    if (!file) return;

    try {
      setUploading(kind);

      if (kind === "footer-logo") {
        const path = await uploadFooterLogo(file);
        setField("footer_logo_path", path);
        toast.success("Logo do rodapé enviada com sucesso.");
        return;
      }

      if (kind === "favicon") {
        const allowedMimeTypes = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"];
        const ext = file.name.split(".").pop()?.toLowerCase();
        const allowedExts = ["png", "ico", "svg"];

        if (!allowedMimeTypes.includes(file.type) && (!ext || !allowedExts.includes(ext))) {
          toast.error("Formato inválido. Use PNG, ICO ou SVG.");
          return;
        }

        const path = await uploadFavicon(file);
        setField("favicon_path", path);
        toast.success("Favicon enviado com sucesso.");
        return;
      }

      const url =
        kind === "banner"
          ? await uploadPublicImage({ bucket: BUCKET, path: "home/banner/banner", file })
          : await uploadPublicImage({ bucket: BUCKET, path: "home/territory/territory", file });

      const busted = withCacheBuster(url);

      if (kind === "banner") setField("home_banner_image_url", busted);
      if (kind === "territory") setField("home_territory_image_url", busted);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar imagem.");
    } finally {
      setUploading(null);
      if (kind === "banner" && bannerFileRef.current) bannerFileRef.current.value = "";
      if (kind === "territory" && territoryFileRef.current) territoryFileRef.current.value = "";
      if (kind === "footer-logo" && footerLogoFileRef.current) footerLogoFileRef.current.value = "";
      if (kind === "favicon" && faviconFileRef.current) faviconFileRef.current.value = "";
    }
  }

  async function onSave() {
    if (!isValidEmail(form.footer_email)) {
      toast.error("Informe um e-mail válido para o rodapé.");
      return;
    }

    try {
      setSaving(true);

      await Promise.all([
        updateSiteSettings({
          home_banner_image_url: form.home_banner_image_url || null,
          home_banner_title: form.home_banner_title || null,
          home_banner_subtitle: form.home_banner_subtitle || null,

          home_territory_image_url: form.home_territory_image_url || null,
          home_territory_title: form.home_territory_title || null,
          home_territory_subtitle: form.home_territory_subtitle || null,
        }),
        upsertFooterSettings({
          footer_logo_path: form.footer_logo_path || null,
          favicon_path: form.favicon_path || null,
          footer_description: form.footer_description || null,
          footer_email: form.footer_email || null,
          footer_instagram_url: form.footer_instagram_url || null,
          footer_whatsapp: form.footer_whatsapp || null,
          footer_facebook_url: form.footer_facebook_url || null,
          footer_linkedin_url: form.footer_linkedin_url || null,
          footer_youtube_url: form.footer_youtube_url || null,
          footer_location: form.footer_location || null,
          footer_address_short: form.footer_address_short || null,
          footer_maps_url: form.footer_maps_url || null,
        }),
      ]);

      toast.success("Configurações salvas!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar configurações.");
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

        {/* Rodapé */}
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
          <h3 className="font-semibold text-lg border-b pb-4">Rodapé</h3>


          <section className="space-y-3">
            <h4 className="font-medium">Favicon</h4>
            <input
              ref={faviconFileRef}
              type="file"
              accept=".png,.ico,.svg,image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
              className="hidden"
              onChange={(e) => handleUpload("favicon", e.target.files?.[0])}
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 w-full md:max-w-xs cursor-pointer bg-muted/10"
                onClick={() => {
                  if (uploading === "favicon") return;
                  faviconFileRef.current?.click();
                }}
              >
                {form.favicon_path ? (
                  <img
                    src={buildPublicStorageUrl(form.favicon_path)}
                    alt="Favicon"
                    className="w-16 h-16 object-contain rounded-md border bg-white"
                  />
                ) : (
                  <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Enviar favicon</div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm border rounded-md"
                  onClick={() => faviconFileRef.current?.click()}
                  disabled={uploading === "favicon"}
                >
                  {uploading === "favicon" ? "Enviando..." : "Upload"}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border rounded-md text-red-600 inline-flex items-center gap-1"
                  onClick={() => setField("favicon_path", "")}
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Formatos aceitos: PNG, ICO e SVG.</p>
          </section>
          <section className="space-y-3">
            <h4 className="font-medium">Logo do rodapé</h4>
            <input
              ref={footerLogoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUpload("footer-logo", e.target.files?.[0])}
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 w-full md:max-w-xs cursor-pointer bg-muted/10"
                onClick={() => {
                  if (uploading === "footer-logo") return;
                  footerLogoFileRef.current?.click();
                }}
              >
                {form.footer_logo_path ? (
                  <img
                    src={buildPublicStorageUrl(form.footer_logo_path)}
                    alt="Logo do rodapé"
                    className="w-full h-24 object-contain rounded-md border bg-white"
                  />
                ) : (
                  <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Enviar logo</div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm border rounded-md"
                  onClick={() => footerLogoFileRef.current?.click()}
                  disabled={uploading === "footer-logo"}
                >
                  {uploading === "footer-logo" ? "Enviando..." : "Upload"}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border rounded-md text-red-600 inline-flex items-center gap-1"
                  onClick={() => setField("footer_logo_path", "")}
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium">Descrição curta</h4>
            <textarea
              value={form.footer_description}
              onChange={(e) => setField("footer_description", e.target.value.slice(0, FOOTER_DESCRIPTION_MAX_CHARS))}
              rows={3}
              className="w-full px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="Resumo rápido do rodapé"
            />
            <p className="text-xs text-muted-foreground text-right">
              {footerDescriptionCount}/{FOOTER_DESCRIPTION_MAX_CHARS}
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium">Contato</h4>
            <input
              type="email"
              value={form.footer_email}
              onChange={(e) => setField("footer_email", e.target.value)}
              placeholder="contato@exemplo.com"
              className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
            {!isValidEmail(form.footer_email) && <p className="text-xs text-amber-600">E-mail parece inválido.</p>}
          </section>

          <section className="space-y-2">
            <h4 className="font-medium">Redes sociais</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {([
                ["footer_instagram_url", "Instagram URL"],
                ["footer_whatsapp", "WhatsApp (número ou link)"],
                ["footer_facebook_url", "Facebook URL"],
                ["footer_linkedin_url", "LinkedIn URL"],
                ["footer_youtube_url", "YouTube URL (opcional)"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <input
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder={label}
                    className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {urlWarnings[key] && <p className="text-xs text-amber-600">Formato de URL/valor possivelmente inválido.</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-medium">Localização</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                value={form.footer_location}
                onChange={(e) => setField("footer_location", e.target.value)}
                placeholder="Cidade/Estado"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <input
                value={form.footer_address_short}
                onChange={(e) => setField("footer_address_short", e.target.value)}
                placeholder="Endereço curto (opcional)"
                className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <div className="md:col-span-2 space-y-1">
                <input
                  value={form.footer_maps_url}
                  onChange={(e) => setField("footer_maps_url", e.target.value)}
                  placeholder="Link Google Maps (opcional)"
                  className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
                {urlWarnings.footer_maps_url && <p className="text-xs text-amber-600">URL do Maps parece inválida.</p>}
              </div>
            </div>
          </section>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={onSave}
            disabled={saving || loading || !!uploading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : uploading ? "Enviando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
