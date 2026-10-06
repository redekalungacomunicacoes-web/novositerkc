
import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { ok: false, error: "invalid_body" });

    const email = String((body as Record<string, unknown>).email || "").trim().toLowerCase();
    const name = String((body as Record<string, unknown>).name || "").trim();
    const source = String((body as Record<string, unknown>).source || "site_newsletter").trim().slice(0, 120);
    const rawConsent = (body as Record<string, unknown>).consent;
    // Backward compatibility: the current public form already has a required consent checkbox,
    // but older deployed bundles did not send the field to the Edge Function.
    const consent = rawConsent === undefined ? true : Boolean(rawConsent);
    const consentMode = rawConsent === undefined ? "legacy_required_form" : "explicit";

    if (!isEmail(email)) return json(400, { ok: false, error: "invalid_email", message: "Digite um e-mail válido." });
    if (!consent) return json(400, { ok: false, error: "consent_required", message: "É necessário concordar com o recebimento da Newsletter." });

    const userAgent = (req.headers.get("user-agent") || "").slice(0, 1000) || null;
    const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || null;
    const now = new Date().toISOString();

    const { data, error } = await db
      .from("newsletter_subscribers")
      .upsert({
        email,
        name: name || null,
        status: "active",
        subscribed_at: now,
        unsubscribed_at: null,
        source: source || "site_newsletter",
        ip,
        user_agent: userAgent,
        metadata: {
          consent: true,
          consent_at: now,
          source: source || "site_newsletter",
          consent_mode: consentMode,
        },
        updated_at: now,
      }, { onConflict: "email" })
      .select("id,email,name,status,subscribed_at")
      .single();

    if (error) {
      return json(400, { ok: false, error: "subscribe_failed", message: "Não foi possível concluir a inscrição.", details: error.message });
    }

    return json(200, {
      ok: true,
      subscriber: data,
      message: "Inscrição confirmada. Você já faz parte da Newsletter RKC.",
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: "internal_error",
      message: "Erro inesperado ao realizar a inscrição.",
      details: String((error as { message?: string })?.message || error),
    });
  }
});
