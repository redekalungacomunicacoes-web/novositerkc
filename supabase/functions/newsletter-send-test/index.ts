import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { failure, getSmtpSettings, isValidEmail, sendSmtpMail, success, validateSmtpPayload } from "../_shared/newsletter.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response(JSON.stringify(failure("method_not_allowed", "Método não permitido.")), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify(failure("invalid_body", "Body inválido.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const campaignId = String((body as Record<string, unknown>).campaign_id || "").trim();
    const testEmail = String((body as Record<string, unknown>).test_email || "").trim().toLowerCase();

    if (!campaignId) {
      return new Response(JSON.stringify(failure("missing_campaign_id", "campaign_id é obrigatório.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!isValidEmail(testEmail)) {
      return new Response(JSON.stringify(failure("invalid_test_email", "E-mail de teste inválido.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const settingsRes = await getSmtpSettings();
    if (!settingsRes.ok) return new Response(JSON.stringify(settingsRes), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const valid = validateSmtpPayload(settingsRes.data!);
    if (!valid.ok) return new Response(JSON.stringify(valid), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = supabaseAdmin();
    const { data: campaign, error: campaignErr } = await sb
      .from("newsletter_campaigns")
      .select("id,subject,content_html")
      .eq("id", campaignId)
      .single();

    if (campaignErr || !campaign) {
      return new Response(JSON.stringify(failure("campaign_not_found", "Campanha não encontrada.", campaignErr?.message)), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const subject = String(campaign.subject || "").trim();
    const html = String(campaign.content_html || "").trim();
    if (!subject || !html) {
      return new Response(JSON.stringify(failure("campaign_invalid", "Campanha sem assunto ou HTML final para envio.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await sendSmtpMail(settingsRes.data!, { to: testEmail, subject, html });

    return new Response(JSON.stringify(success({ sent: 1, failed: 0, message: "Teste enviado com sucesso." })), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const typed = error as { code?: string; message?: string; details?: string };
    return new Response(JSON.stringify(failure(typed.code || "send_test_failed", typed.message || "Falha ao enviar e-mail de teste.", typed.details)), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
