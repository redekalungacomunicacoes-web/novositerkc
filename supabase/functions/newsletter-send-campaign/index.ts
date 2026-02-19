import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { sendMail } from "../_shared/smtp.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUserFromRequest, getRolesForUser, hasAnyRole } from "../_shared/roles.ts";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // 🔐 auth
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roles = await getRolesForUser(user.id);
    if (!hasAnyRole(roles, ["admin", "editor"])) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const type = String(body.type || "custom"); // "materia" | "custom"
    const subject = String(body.subject || "").trim();
    const html = String(body.html || "").trim();
    const materia_id = body.materia_id ? String(body.materia_id) : null;

    const mode = String(body.mode || "all"); // "test" | "all"
    const test_email = body.test_email ? String(body.test_email).trim().toLowerCase() : null;

    if (!subject || !html) {
      return new Response(JSON.stringify({ error: "Missing subject/html" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "test" && (!test_email || !test_email.includes("@"))) {
      return new Response(JSON.stringify({ error: "Missing test_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = supabaseAdmin();

    // registra campanha
    const { data: camp, error: campErr } = await sb
      .from("newsletter_campaigns")
      .insert({
        type,
        subject,
        html,
        materia_id,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (campErr) {
      return new Response(JSON.stringify({ error: campErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // lista destinatários
    let recipients: string[] = [];
    if (mode === "test") {
      recipients = [test_email!];
    } else {
      const { data: subs, error: subErr } = await sb
        .from("newsletter_subscribers")
        .select("email")
        .eq("status", "active");

      if (subErr) {
        return new Response(JSON.stringify({ error: subErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      recipients = (subs || []).map((s: any) => String(s.email || "").trim().toLowerCase()).filter(Boolean);
    }

    // rate limit simples (config por secret)
    const delayMs = Number(Deno.env.get("NEWSLETTER_DELAY_MS") || 150);
    const max = Number(Deno.env.get("NEWSLETTER_MAX") || 5000);
    recipients = recipients.slice(0, max);

    let sent = 0;
    const errors: string[] = [];

    for (const to of recipients) {
      try {
        await sendMail({ to, subject, html });
        sent++;
      } catch (e) {
        errors.push(`${to}: ${String(e?.message || e)}`);
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    // marca como enviada
    if (mode === "all") {
      await sb.from("newsletter_campaigns").update({ sent_at: new Date().toISOString() }).eq("id", camp.id);
    }

    return new Response(JSON.stringify({ ok: true, campaign_id: camp.id, sent, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
