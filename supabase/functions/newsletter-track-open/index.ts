import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const adminDb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const pixel = Uint8Array.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,33,249,4,1,0,0,0,0,
  44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59,
]);

function pixelResponse() {
  return new Response(pixel, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(pixel.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
      const { error } = await adminDb.rpc("record_newsletter_open", { p_tracking_token: token });
      if (error) console.error("[newsletter-track-open]", error.message);
    }
  } catch (error) {
    console.error("[newsletter-track-open]", String((error as { message?: string })?.message || error));
  }

  return pixelResponse();
});
