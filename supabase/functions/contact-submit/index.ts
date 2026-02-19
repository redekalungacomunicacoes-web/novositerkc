import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { sendMail } from "../_shared/smtp.ts";
import { contactEmailHtml } from "../_shared/templates.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email || !email.includes("@") || !subject || !message) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = supabaseAdmin();

    // salva no banco
    const { error: dbErr } = await sb.from("contact_messages").insert({
      name,
      email,
      subject,
      message,
      status: "new",
    });

    if (dbErr) {
      return new Response(JSON.stringify({ error: dbErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // envia pro email institucional
    const to = Deno.env.get("CONTACT_TO") || "email@kalungacomunicacoes.org";
    await sendMail({
      to,
      subject: `Contato pelo site: ${subject}`,
      html: contactEmailHtml({ name, email, subject, message }),
      replyTo: email, // responder pro usuário direto
    });

    return new Response(JSON.stringify({ ok: true }), {
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
