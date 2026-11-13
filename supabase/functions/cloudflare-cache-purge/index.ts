import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WORKER_URL = "https://rkc-public-materias-cache.redekalungacomunicacoes.workers.dev";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const purgeSecret = Deno.env.get("RKC_CACHE_PURGE_SECRET");
  if (!authorization || !supabaseUrl || !anonKey || !purgeSecret) {
    return json({ error: "Cache invalidation is not configured." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const { data: allowed, error: roleError } = await userClient.rpc("has_role", {
    required: ["admin_alfa", "admin", "editor", "autor"],
  });
  if (roleError || allowed !== true) return json({ error: "Forbidden" }, 403);

  try {
    const response = await fetch(`${WORKER_URL}/__cache/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${purgeSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags: ["rkc-public-materias", "rkc-public-media"] }),
    });
    if (!response.ok) return json({ error: "Cloudflare cache invalidation failed." }, 502);
    return json({ success: true });
  } catch {
    return json({ error: "Cloudflare cache invalidation is temporarily unavailable." }, 502);
  }
});
