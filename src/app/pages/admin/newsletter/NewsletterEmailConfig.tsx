import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Aba Admin: Configuração de disparo da Newsletter
 *
 * ⚠️ Segurança:
 * - Não exponha credenciais sensíveis em tabelas acessíveis por usuários comuns.
 * - Recomendado: armazenar SMTP em Secrets (Edge Functions) ou criptografar no banco.
 *
 * Este componente é um "primeiro passo" para você ter uma tela de configuração.
 * Ele salva/edita um único registro na tabela `newsletter_email_settings` (se você criar).
 */

type EmailSettingsRow = {
  id: string;
  from_email: string;
  from_name: string;

  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;

  smtp_secure: boolean;
  reply_to: string | null;

  delay_ms: number;
  max_per_send: number;

  provider: string; // smtp | resend | sendgrid | etc
};

const DEFAULTS: Omit<EmailSettingsRow, "id"> = {
  from_email: "",
  from_name: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_pass: "",
  smtp_secure: false,
  reply_to: null,
  delay_ms: 150,
  max_per_send: 5000,
  provider: "smtp",
};

export function NewsletterEmailConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);

  const [form, setForm] = useState(DEFAULTS);

  const canSave = useMemo(() => {
    if (form.provider === "smtp") {
      return (
        form.from_email.trim() &&
        form.from_name.trim() &&
        form.smtp_host.trim() &&
        Number(form.smtp_port) > 0 &&
        form.smtp_user.trim() &&
        form.smtp_pass.trim()
      );
    }
    // para outros providers, ajuste as regras
    return form.from_email.trim() && form.from_name.trim();
  }, [form]);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("newsletter_email_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRowId(data.id);
        setForm({
          from_email: data.from_email ?? "",
          from_name: data.from_name ?? "",
          smtp_host: data.smtp_host ?? "",
          smtp_port: Number(data.smtp_port ?? 587),
          smtp_user: data.smtp_user ?? "",
          smtp_pass: data.smtp_pass ?? "",
          smtp_secure: Boolean(data.smtp_secure ?? false),
          reply_to: data.reply_to ?? null,
          delay_ms: Number(data.delay_ms ?? 150),
          max_per_send: Number(data.max_per_send ?? 5000),
          provider: data.provider ?? "smtp",
        });
      } else {
        setRowId(null);
        setForm(DEFAULTS);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (!canSave) {
        alert("Preencha os campos obrigatórios.");
        return;
      }

      const payload = {
        ...form,
        smtp_port: Number(form.smtp_port || 587),
        delay_ms: Number(form.delay_ms || 150),
        max_per_send: Number(form.max_per_send || 5000),
        reply_to: form.reply_to?.trim() ? form.reply_to.trim() : null,
        updated_at: new Date().toISOString(),
        ...(rowId ? { id: rowId } : {}),
      };

      const { data, error } = await supabase
        .from("newsletter_email_settings")
        .upsert(payload, { onConflict: "id" })
        .select("id")
        .single();

      if (error) throw error;

      setRowId(data.id);
      alert("Configuração salva!");
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-6">Carregando…</div>;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Configuração de E-mail</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure remetente e parâmetros técnicos do disparo da newsletter.
      </p>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Provider</label>
          <select
            className="border rounded-md p-2 bg-transparent"
            value={form.provider}
            onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
          >
            <option value="smtp">SMTP</option>
            <option value="resend">Resend (opcional)</option>
            <option value="sendgrid">Sendgrid (opcional)</option>
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">From (email)</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              value={form.from_email}
              onChange={(e) => setForm((p) => ({ ...p, from_email: e.target.value }))}
              placeholder="ex: newsletter@seudominio.com"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">From (nome)</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              value={form.from_name}
              onChange={(e) => setForm((p) => ({ ...p, from_name: e.target.value }))}
              placeholder="ex: Rede Kalunga Comunicações"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">Reply-To (opcional)</label>
          <input
            className="border rounded-md p-2 bg-transparent"
            value={form.reply_to ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, reply_to: e.target.value }))}
            placeholder="ex: contato@seudominio.com"
          />
        </div>

        <hr className="my-2 opacity-40" />

        <h2 className="text-lg font-semibold">SMTP</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Host</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              value={form.smtp_host}
              onChange={(e) => setForm((p) => ({ ...p, smtp_host: e.target.value }))}
              placeholder="ex: smtp.gmail.com"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Porta</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              type="number"
              value={form.smtp_port}
              onChange={(e) => setForm((p) => ({ ...p, smtp_port: Number(e.target.value) }))}
              placeholder="587"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Usuário</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              value={form.smtp_user}
              onChange={(e) => setForm((p) => ({ ...p, smtp_user: e.target.value }))}
              placeholder="ex: seuemail@dominio.com"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Senha</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              type="password"
              value={form.smtp_pass}
              onChange={(e) => setForm((p) => ({ ...p, smtp_pass: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.smtp_secure}
            onChange={(e) => setForm((p) => ({ ...p, smtp_secure: e.target.checked }))}
          />
          Usar conexão segura (SSL/TLS)
        </label>

        <hr className="my-2 opacity-40" />

        <h2 className="text-lg font-semibold">Limites e desempenho</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Delay por envio (ms)</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              type="number"
              value={form.delay_ms}
              onChange={(e) => setForm((p) => ({ ...p, delay_ms: Number(e.target.value) }))}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Máximo por disparo</label>
            <input
              className="border rounded-md p-2 bg-transparent"
              type="number"
              value={form.max_per_send}
              onChange={(e) => setForm((p) => ({ ...p, max_per_send: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            className="px-4 py-2 rounded-md border"
            onClick={load}
            disabled={saving}
          >
            Recarregar
          </button>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-60"
            onClick={save}
            disabled={saving || !canSave}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Dica: para segurança máxima, use Secrets nas Edge Functions (SMTP_*).
          Esta tela pode ser usada para parâmetros não sensíveis (from, delay, max)
          ou com criptografia no banco.
        </p>
      </div>
    </div>
  );
}
