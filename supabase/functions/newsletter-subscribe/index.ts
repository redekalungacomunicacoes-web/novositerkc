import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { sendMail } from "../_shared/smtp.ts";
import { welcomeNewsletterHtml } from "../_shared/templates.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = supabaseAdmin();

    // Upsert por email
    const { data, error } = await sb
      .from("newsletter_subscribers")
      .upsert(
        { email, name: name || null, status: "active" },
        { onConflict: "email" }
      )
      .select("id,email,name,status")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Boas-vindas opcional
    const welcomeEnabled = String(Deno.env.get("WELCOME_EMAIL_ENABLED") || "").toLowerCase() === "true";
    if (welcomeEnabled) {
      try {
        await sendMail({
          to: email,
          subject: "Bem-vindo(a) à Newsletter • Rede Kalunga Comunicações",
          html: welcomeNewsletterHtml(name),
        });
      } catch {
        // não quebra a inscrição se falhar email
      }
    }

    return new Response(JSON.stringify({ ok: true, subscriber: data }), {
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
