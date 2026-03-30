import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { failure, getSmtpSettings, sendSmtpMail, success, validateSmtpPayload } from "../_shared/newsletter.ts";

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
    const settingsRes = await getSmtpSettings();
    if (!settingsRes.ok) {
      return new Response(JSON.stringify(settingsRes), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const valid = validateSmtpPayload(settingsRes.data!);
    if (!valid.ok) {
      return new Response(JSON.stringify(valid), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await sendSmtpMail(settingsRes.data!, {
      to: settingsRes.data!.from_email,
      subject: "[Validação SMTP] Conexão validada com sucesso",
      html: "<p>Validação SMTP concluída com sucesso.</p>",
    });

    return new Response(JSON.stringify(success({ message: "Configuração SMTP validada com sucesso." })), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const typed = error as { code?: string; message?: string; details?: string };
    return new Response(JSON.stringify(failure(typed.code || "smtp_validation_failed", typed.message || "Falha na validação SMTP.", typed.details)), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
