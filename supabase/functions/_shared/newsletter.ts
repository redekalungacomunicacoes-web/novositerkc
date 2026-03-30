import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import { supabaseAdmin } from "./supabase.ts";

export type ErrorPayload = {
  code: string;
  message: string;
  details?: string;
};

export type NewsletterResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: ErrorPayload;
};

export type SmtpSettings = {
  id: string;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  secure: boolean;
  reply_to: string | null;
  delay_ms: number;
  max_per_send: number;
};

export function success<T>(data: T): NewsletterResult<T> {
  return { ok: true, data };
}

export function failure(code: string, message: string, details?: string): NewsletterResult {
  return { ok: false, error: { code, message, details } };
}

export function isValidEmail(email: string) {
  const v = (email || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizeMessage(error: unknown) {
  const msg = String((error as { message?: string })?.message || error || "Erro desconhecido");
  const lower = msg.toLowerCase();

  if (lower.includes("enotfound") || lower.includes("no such host")) {
    return { code: "smtp_host_invalid", message: "Host SMTP inválido ou não encontrado.", details: msg };
  }
  if (lower.includes("econnrefused") || lower.includes("connection refused")) {
    return { code: "smtp_connection_refused", message: "Conexão SMTP recusada pelo servidor/porta.", details: msg };
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return { code: "smtp_timeout", message: "Timeout ao conectar no servidor SMTP.", details: msg };
  }
  if (lower.includes("auth") || lower.includes("535") || lower.includes("invalid login")) {
    return { code: "smtp_auth_failed", message: "Falha de autenticação SMTP. Verifique usuário e senha.", details: msg };
  }

  return { code: "smtp_error", message: "Erro ao comunicar com o servidor SMTP.", details: msg };
}

export async function getSmtpSettings() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("newsletter_email_settings")
    .select("id,from_email,from_name,smtp_host,smtp_port,smtp_user,smtp_pass,smtp_secure,reply_to,delay_ms,max_per_send")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return failure("settings_load_failed", "Não foi possível carregar configuração SMTP.", error.message);
  if (!data) return failure("settings_not_found", "Configuração SMTP ainda não foi cadastrada.");

  const mapped: SmtpSettings = {
    id: data.id,
    from_email: data.from_email,
    from_name: data.from_name,
    smtp_host: data.smtp_host,
    smtp_port: Number(data.smtp_port || 0),
    smtp_user: data.smtp_user,
    smtp_password: data.smtp_pass,
    secure: Boolean(data.smtp_secure),
    reply_to: data.reply_to ?? null,
    delay_ms: Number(data.delay_ms || 150),
    max_per_send: Number(data.max_per_send || 5000),
  };

  return success(mapped);
}

export function validateSmtpPayload(settings: SmtpSettings) {
  if (!settings.from_name?.trim()) return failure("missing_from_name", "Campo obrigatório ausente: from_name.");
  if (!isValidEmail(settings.from_email)) return failure("invalid_from_email", "from_email inválido.");
  if (!settings.smtp_host?.trim()) return failure("missing_smtp_host", "Campo obrigatório ausente: smtp_host.");
  if (!Number.isFinite(settings.smtp_port) || settings.smtp_port <= 0) {
    return failure("invalid_smtp_port", "smtp_port inválida.");
  }
  if (!settings.smtp_user?.trim()) return failure("missing_smtp_user", "Campo obrigatório ausente: smtp_user.");
  if (!settings.smtp_password?.trim()) {
    return failure("missing_smtp_password", "Campo obrigatório ausente: smtp_password.");
  }

  return success({ valid: true });
}

export function renderMateriaHtml(input: {
  title: string;
  summary?: string | null;
  cover_image?: string | null;
  link: string;
}) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
    <h1 style="font-size:22px;margin:0 0 12px;">${input.title}</h1>
    ${input.cover_image ? `<img src="${input.cover_image}" alt="${input.title}" style="max-width:100%;height:auto;border-radius:8px;margin-bottom:14px;" />` : ""}
    ${input.summary ? `<p style="font-size:15px;line-height:1.5;margin:0 0 18px;">${input.summary}</p>` : ""}
    <a href="${input.link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 16px;background:#0F7A3E;color:#fff;text-decoration:none;border-radius:6px;">Ler matéria</a>
  </div>`;
}

export async function sendSmtpMail(settings: SmtpSettings, payload: { to: string; subject: string; html: string }) {
  const client = new SmtpClient();
  try {
    await client.connect({
      hostname: settings.smtp_host,
      port: settings.smtp_port,
      username: settings.smtp_user,
      password: settings.smtp_password,
      tls: settings.secure || settings.smtp_port === 465,
    });

    await client.send({
      from: `${settings.from_name} <${settings.from_email}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      content: "",
      headers: settings.reply_to ? { "Reply-To": settings.reply_to } : undefined,
    });
  } catch (error) {
    throw normalizeMessage(error);
  } finally {
    try {
      await client.close();
    } catch {
      // noop
    }
  }
}
