import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { failure, getSmtpSettings, isValidEmail, renderMateriaHtml, sendSmtpMail, success, validateSmtpPayload } from "../_shared/newsletter.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

type CampaignStatus = "draft" | "sent" | "failed" | "sending";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    if (!campaignId) {
      return new Response(JSON.stringify(failure("missing_campaign_id", "campaign_id é obrigatório.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const settingsRes = await getSmtpSettings();
    if (!settingsRes.ok) return new Response(JSON.stringify(settingsRes), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const validSettings = validateSmtpPayload(settingsRes.data!);
    if (!validSettings.ok) return new Response(JSON.stringify(validSettings), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = supabaseAdmin();

    const { data: campaign, error: campaignErr } = await sb
      .from("newsletter_campaigns")
      .select("id,title,subject,mode,materia_id,content_html,status,sent_count,fail_count")
      .eq("id", campaignId)
      .single();

    if (campaignErr || !campaign) {
      return new Response(JSON.stringify(failure("campaign_not_found", "Campanha não encontrada.", campaignErr?.message)), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (campaign.status === "sent") {
      return new Response(JSON.stringify(failure("campaign_already_sent", "Esta campanha já foi enviada.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let finalHtml = String(campaign.content_html || "").trim();
    if (campaign.mode === "materia") {
      if (!campaign.materia_id) {
        return new Response(JSON.stringify(failure("missing_materia_id", "Campanha por matéria sem materia_id.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: materia, error: materiaErr } = await sb
        .from("materias")
        .select("id,titulo,resumo,slug,cover_image")
        .eq("id", campaign.materia_id)
        .single();

      if (materiaErr || !materia) {
        return new Response(JSON.stringify(failure("materia_not_found", "Matéria vinculada não foi encontrada.", materiaErr?.message)), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const siteUrl = Deno.env.get("SITE_URL") || "https://kalungacomunicacoes.org";
      const path = materia.slug ? `/materias/${materia.slug}` : `/materias/${materia.id}`;
      finalHtml = renderMateriaHtml({
        title: materia.titulo,
        summary: materia.resumo,
        cover_image: materia.cover_image,
        link: `${siteUrl}${path}`,
      });

      await sb.from("newsletter_campaigns").update({ content_html: finalHtml, updated_at: new Date().toISOString() }).eq("id", campaign.id);
    }

    const subject = String(campaign.subject || "").trim();
    if (!subject || !finalHtml) {
      return new Response(JSON.stringify(failure("campaign_invalid", "Campanha sem assunto ou HTML final.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: recipientsRows, error: recErr } = await sb
      .from("newsletter_subscribers")
      .select("email")
      .eq("status", "active");

    if (recErr) {
      return new Response(JSON.stringify(failure("recipients_load_failed", "Erro ao carregar destinatários.", recErr.message)), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const recipients = (recipientsRows || [])
      .map((row) => String(row.email || "").trim().toLowerCase())
      .filter((email) => isValidEmail(email));

    if (recipients.length === 0) {
      await sb.from("newsletter_campaigns").update({ status: "failed" as CampaignStatus, updated_at: new Date().toISOString() }).eq("id", campaign.id);
      return new Response(JSON.stringify(failure("no_recipients", "Não há destinatários ativos para esta campanha.")), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await sb.from("newsletter_campaigns").update({ status: "sending" as CampaignStatus, updated_at: new Date().toISOString() }).eq("id", campaign.id);

    const limit = Math.max(1, Math.min(settingsRes.data!.max_per_send || 5000, 20000));
    const delay = Math.max(0, settingsRes.data!.delay_ms || 0);
    const recipientsLimited = recipients.slice(0, limit);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const email of recipientsLimited) {
      try {
        await sendSmtpMail(settingsRes.data!, { to: email, subject, html: finalHtml });
        sent += 1;
      } catch (error) {
        failed += 1;
        const typed = error as { message?: string; details?: string };
        errors.push(`${email}: ${typed.message || "Erro SMTP"}${typed.details ? ` (${typed.details})` : ""}`);
      }
      if (delay > 0) await sleep(delay);
    }

    const status: CampaignStatus = failed > 0 ? "failed" : "sent";

    await sb
      .from("newsletter_campaigns")
      .update({
        status,
        sent_count: sent,
        fail_count: failed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    return new Response(JSON.stringify(success({ campaign_id: campaign.id, sent, failed, status, errors })), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify(failure("internal_error", "Erro interno ao enviar campanha.", String((error as { message?: string })?.message || error))), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
