
import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function page(title: string, message: string, ok = true) {
  const accent = ok ? "#0F7A3E" : "#B42318";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f5f5f1;font-family:Arial,Helvetica,sans-serif;color:#222"><main style="max-width:620px;margin:64px auto;padding:20px"><div style="background:#fff;border:1px solid #e5e5df;border-radius:16px;padding:32px"><div style="font-size:14px;font-weight:700;color:${accent};margin-bottom:8px">Rede Kalunga Comunicações</div><h1 style="font-size:26px;margin:0 0 14px">${title}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 22px">${message}</p><a href="https://kalungacomunicacoes.org" style="display:inline-block;background:#0F7A3E;color:#fff;text-decoration:none;padding:11px 16px;border-radius:8px">Voltar ao site</a></div></main></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return page("Método não permitido", "Não foi possível processar esta solicitação.", false);

  try {
    const requestUrl = new URL(req.url);
    let token = requestUrl.searchParams.get("token") || "";

    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (body && typeof body === "object") token = String((body as Record<string, unknown>).token || "");
    }

    token = token.trim();
    if (!token) return page("Link inválido", "O link de cancelamento está incompleto ou expirou.", false);

    const { data: subscriber, error: findError } = await db
      .from("newsletter_subscribers")
      .select("id,email,status")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (findError || !subscriber) return page("Link inválido", "Não encontramos uma inscrição correspondente a este link.", false);

    if (subscriber.status !== "unsubscribed") {
      const now = new Date().toISOString();
      const { error } = await db
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed", unsubscribed_at: now, updated_at: now })
        .eq("id", subscriber.id);

      if (error) return page("Não foi possível cancelar", "Tente novamente em instantes.", false);

      await db
        .from("newsletter_deliveries")
        .update({ status: "unsubscribed", unsubscribed_at: now })
        .eq("subscriber_id", subscriber.id)
        .eq("status", "queued");
    }

    return page("Inscrição cancelada", "Você não receberá novos disparos da Newsletter RKC. Caso queira voltar, basta se inscrever novamente pelo site.");
  } catch {
    return page("Não foi possível cancelar", "Ocorreu um erro inesperado. Tente novamente em instantes.", false);
  }
});
