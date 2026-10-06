
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: { code: "method_not_allowed", message: "Método não permitido." } }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const target = String(Deno.env.get("SUPABASE_URL") || "") + "/functions/v1/newsletter-admin";
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = req.method === "POST" ? "save_settings" : "get_settings";

  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      apikey,
    },
    body: JSON.stringify({
      action,
      ...(req.method === "POST" ? { settings: body } : {}),
    }),
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": response.headers.get("content-type") || "application/json" },
  });
});
