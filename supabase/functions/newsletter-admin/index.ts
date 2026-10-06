
import { createClient } from "npm:@supabase/supabase-js@2.94.1";
import nodemailer from "npm:nodemailer@6.9.13";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ApiError = { code: string; message: string; details?: string };
type Settings = {
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
  provider: string | null;
};
type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  source: string | null;
  tags: string[];
  unsubscribe_token: string;
};
type Campaign = {
  id: string;
  title: string | null;
  subject: string;
  preview_text: string | null;
  content_html: string | null;
  status: string;
  audience_mode: string | null;
  audience_filter: Record<string, unknown> | null;
  template_id: string | null;
  provider: string | null;
  sent_count: number | null;
  fail_count: number | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
function ok<T>(data: T) { return json(200, { ok: true, data }); }
function fail(code: string, message: string, details?: string, status = 200) {
  const error: ApiError = { code, message, ...(details ? { details } : {}) };
  return json(status, { ok: false, error });
}
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}
function escapeHtml(value: string) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlToText(value: string) {
  return (value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function smtpRecipients(info: any) {
  const accepted = Array.isArray(info?.accepted) ? info.accepted.map((value: unknown) => String(value).toLowerCase()) : [];
  const rejected = Array.isArray(info?.rejected) ? info.rejected.map((value: unknown) => String(value).toLowerCase()) : [];
  return { accepted, rejected };
}

function smtpAccepted(info: any, email: string) {
  const { accepted } = smtpRecipients(info);
  return accepted.includes(email.trim().toLowerCase());
}

const supabaseUrl = required("SUPABASE_URL");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const adminDb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function requireAdmin(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return { ok: false as const, response: fail("missing_auth", "Sessão administrativa ausente.", undefined, 401) };
  }
  if (!publicKey) {
    return { ok: false as const, response: fail("missing_public_key", "Configuração interna de autenticação ausente.", undefined, 500) };
  }

  const userClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data, error } = await userClient.rpc("is_admin_or_editor");
  if (error || data !== true) {
    return {
      ok: false as const,
      response: fail("forbidden", "Seu usuário não tem permissão para administrar a Newsletter.", error?.message, 403),
    };
  }
  return { ok: true as const };
}

async function getSettings(): Promise<Settings> {
  const { data, error } = await adminDb
    .from("newsletter_email_settings")
    .select("id,from_email,from_name,smtp_host,smtp_port,smtp_user,smtp_pass,smtp_secure,reply_to,delay_ms,max_per_send,provider")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível carregar a configuração de e-mail: ${error.message}`);
  if (!data) throw new Error("Nenhuma configuração de e-mail foi cadastrada.");

  return {
    ...data,
    smtp_port: Number(data.smtp_port || 0),
    delay_ms: Number(data.delay_ms || 0),
    max_per_send: Number(data.max_per_send || 5000),
    smtp_secure: Boolean(data.smtp_secure),
  } as Settings;
}

function validateSettings(s: Settings) {
  if (!s.from_name?.trim()) throw new Error("Nome do remetente não configurado.");
  if (!isEmail(s.from_email)) throw new Error("E-mail do remetente inválido.");
  if (!s.smtp_host?.trim()) throw new Error("Host SMTP não configurado.");
  if (!Number.isFinite(s.smtp_port) || s.smtp_port <= 0) throw new Error("Porta SMTP inválida.");
  if (!s.smtp_user?.trim()) throw new Error("Usuário SMTP não configurado.");
  if (!s.smtp_pass?.trim()) throw new Error("Senha SMTP não configurada.");
}

function transportFor(s: Settings) {
  validateSettings(s);
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure: s.smtp_secure || s.smtp_port === 465,
    auth: { user: s.smtp_user, pass: s.smtp_pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

async function loadCampaign(id: string): Promise<Campaign> {
  const { data, error } = await adminDb
    .from("newsletter_campaigns")
    .select("id,title,subject,preview_text,content_html,status,audience_mode,audience_filter,template_id,provider,sent_count,fail_count")
    .eq("id", id)
    .single();

  if (error || !data) throw new Error(error?.message || "Campanha não encontrada.");
  return data as Campaign;
}

async function loadTemplate(templateId?: string | null) {
  let query = adminDb
    .from("newsletter_templates")
    .select("id,name,slug,content_html,active");

  if (templateId) {
    query = query.eq("id", templateId);
  } else {
    query = query.eq("slug", "rkc-base-editorial");
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(`Falha ao carregar template: ${error.message}`);
  return data || null;
}

function renderHtml(args: {
  templateHtml?: string | null;
  bodyHtml: string;
  unsubscribeUrl: string;
  previewText?: string | null;
  name?: string | null;
  email?: string | null;
  trackingPixelUrl?: string | null;
}) {
  const preview = args.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(args.previewText)}</div>`
    : "";

  const body = args.bodyHtml
    .replaceAll("{{name}}", escapeHtml(args.name || ""))
    .replaceAll("{{email}}", escapeHtml(args.email || ""));

  const fallback = `
    <div style="margin:0;background:#f5f5f1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#202020">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e8e2">
        <div style="padding:22px 26px;background:#0F7A3E;color:#ffffff">
          <div style="font-size:20px;font-weight:700">Rede Kalunga Comunicações</div>
          <div style="font-size:13px;opacity:.9;margin-top:4px">Jornalismo comunitário do Território Kalunga</div>
        </div>
        <div style="padding:28px">${body}</div>
        <div style="padding:18px 26px;background:#fafaf7;border-top:1px solid #ecece6;font-size:12px;line-height:1.6;color:#666">
          Você recebeu esta mensagem porque se inscreveu na Newsletter da RKC.<br>
          <a href="${args.unsubscribeUrl}" style="color:#0F7A3E">Cancelar inscrição</a>
        </div>
      </div>
    </div>`;

  const tpl = (args.templateHtml || fallback)
    .replaceAll("{{content}}", body)
    .replaceAll("{{unsubscribe_url}}", args.unsubscribeUrl)
    .replaceAll("{{name}}", escapeHtml(args.name || ""))
    .replaceAll("{{email}}", escapeHtml(args.email || ""))
    .replaceAll("{{preview_text}}", escapeHtml(args.previewText || ""));

  const trackingPixel = args.trackingPixelUrl
    ? `<img src="${args.trackingPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`
    : "";

  return preview + tpl + trackingPixel;
}

async function listAudience(campaign: Campaign): Promise<Subscriber[]> {
  let query = adminDb
    .from("newsletter_subscribers")
    .select("id,email,name,status,source,tags,unsubscribe_token")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const filter = campaign.audience_filter || {};
  const source = typeof filter.source === "string" ? filter.source.trim() : "";
  const tags = Array.isArray(filter.tags) ? filter.tags.filter((v) => typeof v === "string" && v.trim()) as string[] : [];

  if (source) query = query.eq("source", source);
  if (tags.length > 0) query = query.contains("tags", tags);

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao montar a audiência: ${error.message}`);
  return (data || []).filter((s) => isEmail(String(s.email || ""))) as Subscriber[];
}

async function prepareDeliveries(campaign: Campaign, subscribers: Subscriber[]) {
  if (subscribers.length === 0) return;
  const rows = subscribers.map((s) => ({
    campaign_id: campaign.id,
    subscriber_id: s.id,
    email: s.email.trim().toLowerCase(),
    status: "queued",
    provider: campaign.provider || "smtp",
  }));

  const { error } = await adminDb
    .from("newsletter_deliveries")
    .upsert(rows, { onConflict: "campaign_id,email", ignoreDuplicates: true });

  if (error) throw new Error(`Falha ao preparar a fila de envio: ${error.message}`);
}

async function deliveryCounts(campaignId: string) {
  const statuses = ["queued","sending","sent","delivered","failed","bounced","complained","unsubscribed"];
  const result: Record<string, number> = {};
  for (const status of statuses) {
    const { count, error } = await adminDb
      .from("newsletter_deliveries")
      .select("id", { head: true, count: "exact" })
      .eq("campaign_id", campaignId)
      .eq("status", status);
    if (error) throw new Error(error.message);
    result[status] = count || 0;
  }
  return result;
}

async function refreshCampaignStats(campaignId: string) {
  const counts = await deliveryCounts(campaignId);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const sent = (counts.sent || 0) + (counts.delivered || 0);
  const failed = (counts.failed || 0) + (counts.bounced || 0) + (counts.complained || 0);
  const queued = (counts.queued || 0) + (counts.sending || 0);

  const status = queued > 0 ? "sending" : failed > 0 ? "failed" : "sent";
  const patch: Record<string, unknown> = {
    total_recipients: total,
    sent_count: sent,
    fail_count: failed,
    delivered_count: counts.delivered || 0,
    bounce_count: counts.bounced || 0,
    unsubscribe_count: counts.unsubscribed || 0,
    status,
  };
  if (status === "sent") patch.sent_at = new Date().toISOString();

  const { error } = await adminDb.from("newsletter_campaigns").update(patch).eq("id", campaignId);
  if (error) throw new Error(error.message);

  return { counts, total, sent, failed, queued, status };
}

async function actionGetConfig() {
  const s = await getSettings();
  const { smtp_pass: _secret, ...safe } = s;
  return ok({ ...safe, secure: s.smtp_secure, has_password: Boolean(s.smtp_pass) });
}

async function actionSaveConfig(body: Record<string, unknown>) {
  const existing = await getSettings().catch(() => null);
  const password = String(body.smtp_password || "").trim() || existing?.smtp_pass || "";
  const payload = {
    ...(existing?.id ? { id: existing.id } : {}),
    from_name: String(body.from_name || "").trim(),
    from_email: String(body.from_email || "").trim().toLowerCase(),
    smtp_host: String(body.smtp_host || "").trim(),
    smtp_port: Number(body.smtp_port || 0),
    smtp_user: String(body.smtp_user || "").trim(),
    smtp_pass: password,
    smtp_secure: Boolean(body.smtp_secure),
    reply_to: String(body.reply_to || "").trim() || null,
    delay_ms: Math.max(0, Number(body.delay_ms || 0)),
    max_per_send: Math.max(1, Math.min(Number(body.max_per_send || 5000), 5000)),
    provider: "smtp",
    updated_at: new Date().toISOString(),
  } as any;

  validateSettings({
    id: payload.id || "new",
    from_email: payload.from_email,
    from_name: payload.from_name,
    smtp_host: payload.smtp_host,
    smtp_port: payload.smtp_port,
    smtp_user: payload.smtp_user,
    smtp_pass: payload.smtp_pass,
    smtp_secure: payload.smtp_secure,
    reply_to: payload.reply_to,
    delay_ms: payload.delay_ms,
    max_per_send: payload.max_per_send,
    provider: payload.provider,
  });

  const { data, error } = await adminDb
    .from("newsletter_email_settings")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single();

  if (error) return fail("config_save_failed", "Não foi possível salvar a configuração.", error.message);
  return ok({ id: data.id });
}

async function actionValidateSmtp() {
  const s = await getSettings();
  const transport = transportFor(s);
  try {
    await transport.verify();
    console.info("[newsletter] smtp_validate_ok", { from_email: s.from_email });
    return ok({ message: "Conexão SMTP validada com sucesso.", from_email: s.from_email });
  } catch (error) {
    console.error("[newsletter] smtp_validate_failed", String((error as { message?: string })?.message || error));
    throw error;
  } finally {
    transport.close();
  }
}

async function actionSendTest(body: Record<string, unknown>) {
  const campaignId = String(body.campaign_id || "").trim();
  const testEmail = String(body.test_email || "").trim().toLowerCase();
  if (!campaignId) return fail("missing_campaign_id", "Selecione e salve uma campanha antes do teste.");
  if (!isEmail(testEmail)) return fail("invalid_test_email", "Digite um e-mail de teste válido.");

  const [settings, campaign] = await Promise.all([getSettings(), loadCampaign(campaignId)]);
  const template = await loadTemplate(campaign.template_id);
  const bodyHtml = String(campaign.content_html || "").trim();
  if (!campaign.subject?.trim() || !bodyHtml) return fail("invalid_campaign", "A campanha precisa de assunto e conteúdo.");

  const transport = transportFor(settings);
  try {
    await transport.verify();
    const html = renderHtml({
      templateHtml: template?.content_html,
      bodyHtml,
      unsubscribeUrl: "https://kalungacomunicacoes.org/newsletter",
      previewText: campaign.preview_text,
      email: testEmail,
    });
    const unsubscribeUrl = "https://kalungacomunicacoes.org/newsletter";
    const info = await transport.sendMail({
      from: `${settings.from_name} <${settings.from_email}>`,
      to: testEmail,
      subject: campaign.subject,
      html,
      text: htmlToText(bodyHtml),
      replyTo: settings.reply_to || undefined,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "X-RKC-Newsletter-Test": "true",
      },
    });

    const recipients = smtpRecipients(info);
    const accepted = smtpAccepted(info, testEmail);
    const smtpResponse = String(info.response || "");

    console.info("[newsletter] test_send_result", {
      recipient_domain: testEmail.split("@")[1] || "",
      accepted_count: recipients.accepted.length,
      rejected_count: recipients.rejected.length,
      message_id: info.messageId || null,
      response: smtpResponse,
    });

    if (!accepted) {
      return fail(
        "smtp_recipient_rejected",
        "O servidor SMTP não aceitou o destinatário do teste.",
        smtpResponse || recipients.rejected.join(", ") || "Destinatário rejeitado pelo SMTP.",
      );
    }

    return ok({
      message: "SMTP aceitou o e-mail de teste para entrega.",
      message_id: info.messageId || null,
      smtp_response: smtpResponse || null,
      accepted: recipients.accepted,
      rejected: recipients.rejected,
      sent: 1,
      failed: 0,
    });
  } finally {
    transport.close();
  }
}

async function actionSendCampaign(body: Record<string, unknown>) {
  const campaignId = String(body.campaign_id || "").trim();
  if (!campaignId) return fail("missing_campaign_id", "campaign_id é obrigatório.");

  const batchSize = Math.max(1, Math.min(Number(body.batch_size || 40), 80));
  const campaign = await loadCampaign(campaignId);

  if (campaign.status === "sent") {
    return fail("campaign_already_sent", "Essa campanha já foi concluída. Duplique-a para realizar um novo disparo.");
  }

  const settings = await getSettings();
  const template = await loadTemplate(campaign.template_id);
  const bodyHtml = String(campaign.content_html || "").trim();
  if (!campaign.subject?.trim() || !bodyHtml) return fail("invalid_campaign", "A campanha precisa de assunto e conteúdo.");

  const subscribers = await listAudience(campaign);
  if (subscribers.length === 0) {
    await adminDb.from("newsletter_campaigns").update({
      status: "failed",
      last_error: "Nenhum inscrito ativo corresponde à audiência selecionada.",
      total_recipients: 0,
    }).eq("id", campaign.id);
    return fail("empty_audience", "Nenhum inscrito ativo corresponde à audiência selecionada.");
  }

  await prepareDeliveries(campaign, subscribers);

  if (campaign.status !== "sending") {
    const { error } = await adminDb.from("newsletter_campaigns").update({
      status: "sending",
      started_at: new Date().toISOString(),
      total_recipients: subscribers.length,
      last_error: null,
    }).eq("id", campaign.id);
    if (error) return fail("campaign_start_failed", "Não foi possível iniciar a campanha.", error.message);
  }

  const { data: batch, error: batchError } = await adminDb
    .from("newsletter_deliveries")
    .select("id,subscriber_id,email,status,tracking_token")
    .eq("campaign_id", campaign.id)
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(batchSize);

  if (batchError) return fail("queue_load_failed", "Não foi possível carregar a fila de envio.", batchError.message);

  if (!batch || batch.length === 0) {
    const stats = await refreshCampaignStats(campaign.id);
    return ok({ done: true, ...stats, sent_total: stats.sent, fail_total: stats.failed, processed: 0 });
  }

  const subscriberMap = new Map(subscribers.map((s) => [s.id, s]));
  const transport = transportFor(settings);
  let processed = 0;

  try {
    await transport.verify();

    for (const item of batch) {
      const subscriber = item.subscriber_id ? subscriberMap.get(item.subscriber_id) : undefined;
      const token = subscriber?.unsubscribe_token || "";
      const unsubscribeUrl = token
        ? `${supabaseUrl}/functions/v1/newsletter-unsubscribe?token=${encodeURIComponent(token)}`
        : "https://kalungacomunicacoes.org/newsletter";

      await adminDb.from("newsletter_deliveries").update({ status: "sending", error_message: null }).eq("id", item.id);

      try {
        const html = renderHtml({
          templateHtml: template?.content_html,
          bodyHtml,
          unsubscribeUrl,
          previewText: campaign.preview_text,
          name: subscriber?.name || null,
          email: item.email,
          trackingPixelUrl: item.tracking_token
            ? `${supabaseUrl}/functions/v1/newsletter-track-open?token=${encodeURIComponent(item.tracking_token)}`
            : null,
        });

        const info = await transport.sendMail({
          from: `${settings.from_name} <${settings.from_email}>`,
          to: item.email,
          subject: campaign.subject,
          html,
          text: htmlToText(bodyHtml),
          replyTo: settings.reply_to || undefined,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        if (!smtpAccepted(info, item.email)) {
          const recipients = smtpRecipients(info);
          throw new Error(
            String(info.response || "") ||
              `SMTP não aceitou o destinatário. Rejeitados: ${recipients.rejected.join(", ") || "não informado"}`,
          );
        }

        const now = new Date().toISOString();
        await adminDb.from("newsletter_deliveries").update({
          status: "sent",
          sent_at: now,
          provider_message_id: info.messageId || null,
          error_message: null,
        }).eq("id", item.id);

        if (item.subscriber_id) {
          await adminDb.from("newsletter_subscribers").update({ last_sent_at: now }).eq("id", item.subscriber_id);
        }
      } catch (error) {
        const message = String((error as { message?: string })?.message || error);
        await adminDb.from("newsletter_deliveries").update({
          status: "failed",
          error_message: message.slice(0, 1500),
        }).eq("id", item.id);
      }

      processed += 1;
      if (settings.delay_ms > 0) await sleep(Math.min(settings.delay_ms, 1000));
    }
  } finally {
    transport.close();
  }

  const stats = await refreshCampaignStats(campaign.id);
  return ok({ done: stats.queued === 0, ...stats, sent_total: stats.sent, fail_total: stats.failed, processed });
}

async function actionRetryFailed(body: Record<string, unknown>) {
  const campaignId = String(body.campaign_id || "").trim();
  if (!campaignId) return fail("missing_campaign_id", "campaign_id é obrigatório.");

  const { error } = await adminDb
    .from("newsletter_deliveries")
    .update({ status: "queued", error_message: null })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");

  if (error) return fail("retry_prepare_failed", "Não foi possível preparar as falhas para nova tentativa.", error.message);

  await adminDb.from("newsletter_campaigns").update({ status: "sending", last_error: null }).eq("id", campaignId);
  return actionSendCampaign({ ...body, campaign_id: campaignId });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Método não permitido.", undefined, 405);

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("invalid_body", "Corpo da requisição inválido.");

  const payload = body as Record<string, unknown>;
  const action = String(payload.action || "").trim();

  try {
    switch (action) {
      case "get_config":
      case "get_settings":
        return await actionGetConfig();
      case "save_config":
      case "save_settings": {
        const settings = payload.settings && typeof payload.settings === "object"
          ? payload.settings as Record<string, unknown>
          : payload;
        return await actionSaveConfig({
          ...settings,
          smtp_secure: settings.smtp_secure ?? settings.secure,
        });
      }
      case "validate_smtp": return await actionValidateSmtp();
      case "send_test": return await actionSendTest(payload);
      case "send_campaign": return await actionSendCampaign(payload);
      case "retry_failed": return await actionRetryFailed(payload);
      default: return fail("invalid_action", "Ação administrativa de Newsletter inválida.");
    }
  } catch (error) {
    const message = String((error as { message?: string })?.message || error);
    return fail("internal_error", "Não foi possível concluir a operação da Newsletter.", message);
  }
});
