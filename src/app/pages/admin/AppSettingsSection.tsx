import { useEffect, useRef, useState } from "react";
import { ImagePlus, Save, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_APP_SETTINGS, getAppSettings, saveAppSettings, type AppSettings } from "@/lib/appSettings";
import { uploadSiteImage } from "@/lib/siteDrive";

async function validateSquareImage(file: File) {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Use uma imagem PNG, JPG ou WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter até 5 MB.");
  const image = await createImageBitmap(file);
  const isValid = image.width === image.height && image.width >= 192;
  image.close();
  if (!isValid) throw new Error("Use uma imagem quadrada com pelo menos 192 × 192 pixels.");
}

export function AppSettingsSection() {
  const [form, setForm] = useState<AppSettings>({ ...DEFAULT_APP_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getAppSettings()
      .then((settings) => { if (active) setForm(settings); })
      .catch((error) => {
        console.error("Não foi possível carregar as configurações do app:", error);
        toast.error("Não foi possível carregar as configurações do app.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleLogo(file?: File) {
    if (!file) return;
    try {
      setUploading(true);
      await validateSquareImage(file);
      const url = await uploadSiteImage(file, "logo");
      update("app_logo_url", url);
      toast.success("Logo do app enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a logo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!form.app_name.trim() || !form.app_short_name.trim()) {
      toast.error("Preencha o nome do app e o nome curto.");
      return;
    }
    try {
      setSaving(true);
      await saveAppSettings({
        ...form,
        app_name: form.app_name.trim(),
        app_short_name: form.app_short_name.trim(),
        app_description: form.app_description.trim(),
        app_share_title: form.app_share_title.trim(),
        app_share_text: form.app_share_text.trim(),
      });
      toast.success("Configurações do app salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function testShare() {
    const url = window.location.origin;
    const shareData = {
      title: form.app_share_title.trim() || form.app_name,
      text: form.app_share_text.trim() || form.app_description,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText([shareData.title, shareData.text, url].join("\n"));
      toast.success("Texto e link copiados para compartilhar.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível abrir o compartilhamento.");
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="app-settings-title">
      <div className="mb-5 flex items-start gap-3 border-b pb-4">
        <div className="rounded-xl bg-green-100 p-2 text-green-800"><Smartphone className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h2 id="app-settings-title" className="text-lg font-semibold sm:text-xl">Aplicativo da RKC</h2>
          <p className="mt-1 text-sm text-muted-foreground">Identidade, apresentação e compartilhamento do app instalável.</p>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <div className="space-y-2">
            <span className="text-sm font-medium">Logo do app</span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void handleLogo(event.target.files?.[0])} />
            <button type="button" disabled={loading || uploading} onClick={() => fileRef.current?.click()} className="flex aspect-square w-full max-w-36 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed bg-muted/30 text-sm hover:bg-muted/60 disabled:opacity-60" aria-label="Enviar logo quadrada do app">
              {form.app_logo_url ? <img src={form.app_logo_url} alt="Prévia da logo do app" className="h-full w-full object-contain p-2" /> : <><ImagePlus className="h-6 w-6" /><span>{uploading ? "Enviando…" : "Enviar logo"}</span></>}
            </button>
            <p className="max-w-40 text-xs text-muted-foreground">PNG, JPG ou WebP quadrada, mínimo 192 × 192 px.</p>
          </div>

          <div className="grid content-start gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">Nome do aplicativo
              <input value={form.app_name} maxLength={60} onChange={(event) => update("app_name", event.target.value)} disabled={loading} className="h-11 w-full rounded-xl border bg-background px-3 font-normal" placeholder="Rede Kalunga Comunicações" />
            </label>
            <label className="space-y-2 text-sm font-medium">Nome curto
              <input value={form.app_short_name} maxLength={12} onChange={(event) => update("app_short_name", event.target.value)} disabled={loading} className="h-11 w-full rounded-xl border bg-background px-3 font-normal" placeholder="RKC" />
              <span className="block text-xs font-normal text-muted-foreground">{form.app_short_name.length}/12 caracteres</span>
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">Descrição
              <textarea value={form.app_description} maxLength={180} onChange={(event) => update("app_description", event.target.value)} disabled={loading} className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 font-normal" placeholder="O que as pessoas encontram no aplicativo?" />
              <span className="block text-xs font-normal text-muted-foreground">{form.app_description.length}/180 caracteres</span>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <h3 className="mb-3 font-semibold">Prévia da identidade do app</h3>
          <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
            {form.app_logo_url ? <img src={form.app_logo_url} alt="" className="h-12 w-12 rounded-xl object-contain" /> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-green-800 text-xs font-bold text-white">RKC</span>}
            <div className="min-w-0"><p className="truncate font-semibold">{form.app_name || "Nome do aplicativo"}</p><p className="line-clamp-2 text-sm text-muted-foreground">{form.app_description || "A descrição do aplicativo aparecerá aqui."}</p></div>
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="mb-4 flex items-center gap-2"><Share2 className="h-4 w-4" /><h3 className="font-semibold">Compartilhamento</h3></div>
          <label className="mb-4 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={form.app_share_enabled} onChange={(event) => update("app_share_enabled", event.target.checked)} disabled={loading} className="h-4 w-4 accent-green-700" />
            Mostrar a opção de compartilhar o aplicativo
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">Título ao compartilhar
              <input value={form.app_share_title} maxLength={80} onChange={(event) => update("app_share_title", event.target.value)} disabled={loading || !form.app_share_enabled} className="h-11 w-full rounded-xl border bg-background px-3 font-normal" />
            </label>
            <label className="space-y-2 text-sm font-medium">Mensagem de compartilhamento
              <textarea value={form.app_share_text} maxLength={240} onChange={(event) => update("app_share_text", event.target.value)} disabled={loading || !form.app_share_enabled} className="min-h-20 w-full rounded-xl border bg-background px-3 py-2 font-normal" />
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">O botão usa o menu de compartilhamento do celular quando disponível; nos demais casos, copia a mensagem e o link do site.</p>
          <button type="button" onClick={() => void testShare()} disabled={!form.app_share_enabled || loading} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Share2 className="h-4 w-4" /> Testar compartilhamento
          </button>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => void handleSave()} disabled={loading || saving || uploading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-800 px-5 font-semibold text-white hover:bg-green-900 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar configurações do app"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">Nome e logo personalizam a interface mobile do painel. O título e a mensagem controlam o botão de compartilhamento; o nome e o ícone da instalação continuam definidos no manifesto publicado no site.</p>
      </div>
    </section>
  );
}
