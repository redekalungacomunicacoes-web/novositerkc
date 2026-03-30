import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { failure, getSmtpSettings, success, validateSmtpPayload } from "../_shared/newsletter.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method === "GET") {
      const settingsRes = await getSmtpSettings();
      if (!settingsRes.ok) {
        return new Response(JSON.stringify(settingsRes), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { smtp_password: _hidden, ...safeSettings } = settingsRes.data!;
      return new Response(JSON.stringify(success(safeSettings)), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify(failure("method_not_allowed", "Método não permitido.")), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify(failure("invalid_body", "Body inválido.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const password = String((body as Record<string, unknown>).smtp_password || "").trim();
    const settingsRes = await getSmtpSettings();
    const currentPassword = settingsRes.ok ? settingsRes.data!.smtp_password : "";

    const payload = {
      id: settingsRes.ok ? settingsRes.data!.id : undefined,
      from_name: String((body as Record<string, unknown>).from_name || "").trim(),
      from_email: String((body as Record<string, unknown>).from_email || "").trim().toLowerCase(),
      smtp_host: String((body as Record<string, unknown>).smtp_host || "").trim(),
      smtp_port: Number((body as Record<string, unknown>).smtp_port || 0),
      smtp_user: String((body as Record<string, unknown>).smtp_user || "").trim(),
      smtp_password: password || currentPassword,
      secure: Boolean((body as Record<string, unknown>).secure),
      reply_to: String((body as Record<string, unknown>).reply_to || "").trim() || null,
      delay_ms: Number((body as Record<string, unknown>).delay_ms || 150),
      max_per_send: Number((body as Record<string, unknown>).max_per_send || 5000),
    };

    const valid = validateSmtpPayload({
      id: payload.id || "temp-id",
      ...payload,
    });
    if (!valid.ok) return new Response(JSON.stringify(valid), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("newsletter_email_settings")
      .upsert({
        ...(payload.id ? { id: payload.id } : {}),
        from_name: payload.from_name,
        from_email: payload.from_email,
        smtp_host: payload.smtp_host,
        smtp_port: payload.smtp_port,
        smtp_user: payload.smtp_user,
        smtp_pass: payload.smtp_password,
        smtp_secure: payload.secure,
        reply_to: payload.reply_to,
        delay_ms: payload.delay_ms,
        max_per_send: payload.max_per_send,
        provider: "smtp",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select("id")
      .single();

    if (error) {
      return new Response(JSON.stringify(failure("settings_save_failed", "Não foi possível salvar configuração SMTP.", error.message)), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(success({ id: data.id })), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify(failure("internal_error", "Erro interno ao processar configuração SMTP.", String((error as { message?: string })?.message || error))), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
