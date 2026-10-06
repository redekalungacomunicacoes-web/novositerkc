import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Wifi } from "lucide-react";
import { newsletterAdmin, newsletterErrorText } from "./api";

type ConfigPayload = {
  id?: string;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password?: string;
  smtp_secure: boolean;
  reply_to: string | null;
  delay_ms: number;
  max_per_send: number;
  provider?: string | null;
  has_password?: boolean;
};

const DEFAULTS: ConfigPayload = {
  from_email: "",
  from_name: "Rede Kalunga Comunicações",
  smtp_host: "",
  smtp_port: 465,
  smtp_user: "",
  smtp_password: "",
  smtp_secure: true,
  reply_to: null,
  delay_ms: 150,
  max_per_send: 5000,
};

export function NewsletterEmailConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<ConfigPayload>(DEFAULTS);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const canSave = useMemo(
    () =>
      Boolean(
        form.from_name.trim() &&
          form.from_email.trim() &&
          form.smtp_host.trim() &&
          form.smtp_user.trim() &&
          Number(form.smtp_port) > 0,
      ),
    [form],
  );

  async function load() {
    setLoading(true);
    const res = await newsletterAdmin<ConfigPayload>("get_config");
    if (res.ok && res.data) {
      setForm({ ...DEFAULTS, ...res.data, smtp_password: "" });
    } else {
      setMessage({ type: "error", text: newsletterErrorText(res.error) });
    }
    setLoading(false);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);

    const res = await newsletterAdmin<{ id: string }>("save_config", {
      ...form,
      smtp_password: form.smtp_password?.trim() || undefined,
    });

    if (res.ok) {
      setForm((current) => ({ ...current, smtp_password: "", has_password: true }));
      setMessage({ type: "ok", text: "Configuração salva no backend da Newsletter." });
    } else {
      setMessage({ type: "error", text: newsletterErrorText(res.error) });
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    const res = await newsletterAdmin<{ message: string }>("validate_smtp");
    if (res.ok) {
      setMessage({ type: "ok", text: res.data?.message || "Conexão SMTP validada." });
    } else {
      setMessage({ type: "error", text: newsletterErrorText(res.error) });
    }
    setTesting(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando configuração…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-xl font-semibold">Entrega de e-mail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O painel não lê a senha SMTP diretamente. A configuração fica acessível apenas pelo backend administrativo.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><Wifi className="h-4 w-4" /> Provedor atual</div>
          <div className="mt-2 text-lg font-semibold">SMTP</div>
          <div className="text-xs text-muted-foreground">Hostinger / servidor configurado</div>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Credencial</div>
          <div className="mt-2 text-lg font-semibold">{form.has_password ? "Configurada" : "Pendente"}</div>
          <div className="text-xs text-muted-foreground">Senha nunca é devolvida ao navegador</div>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="text-sm font-medium">Remetente</div>
          <div className="mt-2 truncate text-sm font-semibold">{form.from_email || "Não configurado"}</div>
          <div className="text-xs text-muted-foreground">{form.from_name || "Rede Kalunga Comunicações"}</div>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.type === "ok" && <CheckCircle2 className="mr-2 inline h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome do remetente">
          <input className="input-newsletter" value={form.from_name} onChange={(e) => setForm((p) => ({ ...p, from_name: e.target.value }))} />
        </Field>
        <Field label="E-mail do remetente">
          <input type="email" className="input-newsletter" value={form.from_email} onChange={(e) => setForm((p) => ({ ...p, from_email: e.target.value }))} />
        </Field>
        <Field label="Servidor SMTP">
          <input className="input-newsletter" value={form.smtp_host} onChange={(e) => setForm((p) => ({ ...p, smtp_host: e.target.value }))} />
        </Field>
        <Field label="Porta">
          <input type="number" className="input-newsletter" value={form.smtp_port} onChange={(e) => setForm((p) => ({ ...p, smtp_port: Number(e.target.value) }))} />
        </Field>
        <Field label="Usuário SMTP">
          <input className="input-newsletter" value={form.smtp_user} onChange={(e) => setForm((p) => ({ ...p, smtp_user: e.target.value }))} />
        </Field>
        <Field label="Senha SMTP">
          <input
            type="password"
            className="input-newsletter"
            value={form.smtp_password || ""}
            onChange={(e) => setForm((p) => ({ ...p, smtp_password: e.target.value }))}
            placeholder={form.has_password ? "Deixe em branco para manter a atual" : "Digite a senha"}
          />
        </Field>
        <Field label="Reply-To (opcional)">
          <input className="input-newsletter" value={form.reply_to || ""} onChange={(e) => setForm((p) => ({ ...p, reply_to: e.target.value || null }))} />
        </Field>
        <Field label="Intervalo entre mensagens (ms)">
          <input type="number" min={0} max={1000} className="input-newsletter" value={form.delay_ms} onChange={(e) => setForm((p) => ({ ...p, delay_ms: Number(e.target.value) }))} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.smtp_secure} onChange={(e) => setForm((p) => ({ ...p, smtp_secure: e.target.checked }))} />
        Usar conexão segura SSL/TLS
      </label>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar configuração"}
        </button>
        <button
          onClick={testConnection}
          disabled={testing}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {testing ? "Testando conexão…" : "Testar conexão SMTP"}
        </button>
      </div>

      <style>{`.input-newsletter{margin-top:.35rem;width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:.5rem;padding:.625rem .75rem;font-size:.875rem;outline:none}.input-newsletter:focus{box-shadow:0 0 0 2px hsl(var(--ring)/.25)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
