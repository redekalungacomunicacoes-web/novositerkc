import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function required(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function supabaseAdmin() {
  // Você PRECISA setar SUPABASE_SERVICE_ROLE_KEY como Secret no Supabase
  const url = required("SUPABASE_URL");
  const service = required("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, service, { auth: { persistSession: false } });
}

export function supabaseAnon() {
  const url = required("SUPABASE_URL");
  const anon = required("SUPABASE_ANON_KEY");
  return createClient(url, anon, { auth: { persistSession: false } });
}
