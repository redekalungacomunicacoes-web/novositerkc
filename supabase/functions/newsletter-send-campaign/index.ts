import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { sendMail } from "../_shared/smtp.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import {
  getUserFromRequest,
  getRolesForUser,
  hasAnyRole,
} from "../_shared/roles.ts";

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";
type Mode = "test" | "all";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: string) {
  const s = (v || "").trim().toLowerCase();
  return s.includes("@") && s.includes(".");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(v);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" });
    }

    // 🔐 auth
    const user = await getUserFromRequest(req);
    if (!user) return json(401, { ok: false, error: "Unauthorized" });

    const roles = await getRolesForUser(user.id);
    if (!hasAnyRole(roles, ["admin", "editor"])) {
      return json(403, { ok: false, error: "Forbidden" });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json(400, { ok: false, error: "Invalid JSON body" });
    }

    // Você pode:
    // A) Criar + disparar (create_campaign: true)
    // B) Disparar existente (campaign_id)
    const createCampaign = Boolean((body as any).create_campaign);

    const mode = String((body as any).mode || "all") as Mode; // "test" | "all"
    const test_email = (body as any).test_email
      ? String((body as any).test_email).trim().toLowerCase()
      : null;

    if (mode === "test" && (!test_email || !isEmail(test_email))) {
      return json(400, { ok: false, error: "Missing/invalid test_email" });
    }

    const sb = supabaseAdmin();

    // -----------------------------
    // 1) Determina campanha
    // -----------------------------
    let campaignId: string | null = null;

    if (createCampaign) {
      const type = String((body as any).type || "custom"); // opcional
      const title = String((body as any).title || "Campanha sem título").trim();
      const subject = String((body as any).subject || "").trim();
      const content_html = String((body as any).content_html || (body as any).html || "")
        .trim();
      const materia_id = (body as any).materia_id ? String((body as any).materia_id) : null;

      if (!subject || !content_html) {
        return json(400, { ok: false, error: "Missing subject/content_html" });
      }

      const { data: camp, error: campErr } = await sb
        .from("newsletter_campaigns")
        .insert({
          type,
          title,
          subject,
          content_html,
          materia_id,
          created_by: user.id,
          mode: "custom", // sua coluna mode é TEXT (não enum). Pode ajustar se quiser.
          status: "draft" as CampaignStatus,
          sent_count: 0,
          fail_count: 0,
        })
        .select("id,status")
        .single();

      if (campErr) return json(400, { ok: false, error: campErr.message });

      campaignId = camp.id;
    } else {
      const cid = String((body as any).campaign_id || "").trim();
      if (!cid || !isUuid(cid)) {
        return json(400, { ok: false, error: "Missing/invalid campaign_id" });
      }
      campaignId = cid;
    }

    // -----------------------------
    // 2) Carrega campanha (sempre)
    // -----------------------------
    const { data: campaign, error: loadErr } = await sb
      .from("newsletter_campaigns")
      .select("id,title,subject,content_html,status,sent_count,fail_count")
      .eq("id", campaignId)
      .single();

    if (loadErr) return json(400, { ok: false, error: loadErr.message });

    const status = campaign.status as CampaignStatus;
    if (!["draft", "scheduled", "sending", "sent", "failed"].includes(status)) {
      return json(400, {
        ok: false,
        error: `Invalid campaign status stored: ${String(status)}`,
      });
    }

    // Se já estiver sent, não dispara de novo (evita duplicar envio)
    if (status === "sent") {
      return json(409, {
        ok: false,
        error: "Campaign already sent",
        campaign: { id: campaign.id, status },
      });
    }

    const subject = String(campaign.subject || "").trim();
    const html = String(campaign.content_html || "").trim();

    if (!subject || !html) {
      return json(400, {
        ok: false,
        error: "Campaign subject/content_html empty",
        campaign: { id: campaign.id },
      });
    }

    // -----------------------------
    // 3) Lista destinatários
    // -----------------------------
    let recipients: string[] = [];

    if (mode === "test") {
      recipients = [test_email!];
    } else {
      const { data: subs, error: subErr } = await sb
        .from("newsletter_subscribers")
        .select("email")
        .eq("status", "active");

      if (subErr) return json(400, { ok: false, error: subErr.message });

      recipients = (subs || [])
        .map((s: any) => String(s.email || "").trim().toLowerCase())
        .filter((e: string) => isEmail(e));
    }

    // rate limit simples (config por secret)
    const delayMs = Number(Deno.env.get("NEWSLETTER_DELAY_MS") || 150);
    const max = Number(Deno.env.get("NEWSLETTER_MAX") || 5000);
    recipients = recipients.slice(0, max);

    if (recipients.length === 0) {
      // marca failed se não tem ninguém
      await sb
        .from("newsletter_campaigns")
        .update({ status: "failed" as CampaignStatus })
        .eq("id", campaign.id);

      return json(409, {
        ok: false,
        error: "No recipients found",
        campaign_id: campaign.id,
      });
    }

    // -----------------------------
    // 4) Marca como sending
    // -----------------------------
    const { error: updSendingErr } = await sb
      .from("newsletter_campaigns")
      .update({ status: "sending" as CampaignStatus, updated_at: new Date().toISOString() })
      .eq("id", campaign.id);

    if (updSendingErr) {
      return json(400, { ok: false, error: updSendingErr.message });
    }

    // -----------------------------
    // 5) Envia
    // -----------------------------
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const to of recipients) {
      try {
        await sendMail({ to, subject, html });
        sent++;
      } catch (e) {
        failed++;
        errors.push(`${to}: ${String((e as any)?.message || e)}`);
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    // -----------------------------
    // 6) Finaliza campanha
    // -----------------------------
    const finalStatus: CampaignStatus = failed > 0 ? "failed" : "sent";

    const { error: finErr } = await sb
      .from("newsletter_campaigns")
      .update({
        status: finalStatus,
        sent_count: Number(campaign.sent_count || 0) + sent,
        fail_count: Number(campaign.fail_count || 0) + failed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    if (finErr) {
      // se falhar update final, ainda devolve info (mas com 500)
      return json(500, {
        ok: false,
        error: finErr.message,
        campaign_id: campaign.id,
        sent,
        failed,
        errors,
      });
    }

    return json(200, {
      ok: true,
      campaign_id: campaign.id,
      status: finalStatus,
      mode,
      total: recipients.length,
      sent,
      failed,
      errors, // se quiser ocultar em produção, remove aqui
    });
  } catch (e) {
    return json(500, { ok: false, error: String((e as any)?.message || e) });
  }
});
