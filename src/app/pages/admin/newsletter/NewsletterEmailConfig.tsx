import { useEffect, useMemo, useState } from "react";
import { errorText, invokeNewsletter } from "./api";

type ConfigPayload = {
  id?: string;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password?: string;
  secure: boolean;
  reply_to: string | null;
  delay_ms: number;
  max_per_send: number;
};

const DEFAULTS: ConfigPayload = {
  from_email: "",
  from_name: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  secure: false,
  reply_to: null,
  delay_ms: 150,
  max_per_send: 5000,
};

export function NewsletterEmailConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [form, setForm] = useState<ConfigPayload>(DEFAULTS);
  const [message, setMessage] = useState<string | null>(null);

  const canSave = useMemo(() => {
    return Boolean(
      form.from_name.trim() &&
      form.from_email.trim() &&
      form.smtp_host.trim() &&
      form.smtp_user.trim() &&
      Number(form.smtp_port) > 0,
    );
  }, [form]);

  async function load() {
    setLoading(true);
    const res = await invokeNewsletter<Omit<ConfigPayload, "smtp_password">>("newsletter-config");
    if (res.ok && res.data) {
      setForm((prev) => ({ ...prev, ...res.data, smtp_password: "" }));
      setMessage(null);
    } else {
      setMessage(res.error ? errorText(res.error) : null);
    }
    setLoading(false);
  }

  async function save() {
    if (!canSave) {
      setMessage("Preencha os campos obrigatórios da configuração SMTP.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const res = await invokeNewsletter<{ id: string }>("newsletter-config", {
      ...form,
      smtp_password: form.smtp_password?.trim() || undefined,
    });

    if (res.ok) {
      setMessage("Configuração SMTP salva com sucesso.");
      setForm((prev) => ({ ...prev, smtp_password: "" }));
    } else {
      setMessage(errorText(res.error));
    }

    setSaving(false);
  }

  async function validateSmtp() {
    setValidating(true);
    setMessage(null);

    const res = await invokeNewsletter<{ message: string }>("newsletter-validate-smtp", {});
    if (res.ok) {
      setMessage(res.data?.message || "Configuração SMTP validada com sucesso.");
    } else {
      setMessage(errorText(res.error));
    }

    setValidating(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="p-6">Carregando…</div>;

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Configuração SMTP (Hostinger)</h1>

      {message && <div className="rounded-md border px-4 py-3 text-sm bg-muted/30">{message}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">From Name</label>
          <input className="border rounded-md p-2 bg-transparent" value={form.from_name} onChange={(e) => setForm((p) => ({ ...p, from_name: e.target.value }))} />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">From Email</label>
          <input className="border rounded-md p-2 bg-transparent" value={form.from_email} onChange={(e) => setForm((p) => ({ ...p, from_email: e.target.value }))} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">SMTP Host</label>
          <input className="border rounded-md p-2 bg-transparent" value={form.smtp_host} onChange={(e) => setForm((p) => ({ ...p, smtp_host: e.target.value }))} />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">SMTP Port</label>
          <input className="border rounded-md p-2 bg-transparent" type="number" value={form.smtp_port} onChange={(e) => setForm((p) => ({ ...p, smtp_port: Number(e.target.value) }))} />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">SMTP User</label>
          <input className="border rounded-md p-2 bg-transparent" value={form.smtp_user} onChange={(e) => setForm((p) => ({ ...p, smtp_user: e.target.value }))} />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">SMTP Password</label>
          <input className="border rounded-md p-2 bg-transparent" type="password" value={form.smtp_password || ""} onChange={(e) => setForm((p) => ({ ...p, smtp_password: e.target.value }))} placeholder="Deixe em branco para manter a atual" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Reply-To (opcional)</label>
          <input className="border rounded-md p-2 bg-transparent" value={form.reply_to || ""} onChange={(e) => setForm((p) => ({ ...p, reply_to: e.target.value || null }))} />
        </div>
        <label className="flex items-center gap-2 text-sm mt-8">
          <input type="checkbox" checked={form.secure} onChange={(e) => setForm((p) => ({ ...p, secure: e.target.checked }))} />
          secure (SSL/TLS)
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={save} disabled={!canSave || saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
        <button onClick={validateSmtp} disabled={validating} className="rounded-md border px-4 py-2 text-sm">
          {validating ? "Validando..." : "Testar configuração SMTP"}
        </button>
      </div>
    </div>
  );
}
