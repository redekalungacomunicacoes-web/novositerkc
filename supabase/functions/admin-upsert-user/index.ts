import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, roles, equipe_id } = await req.json();

    if (!email || !password) {
      throw new Error("Email e senha são obrigatórios");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) cria ou atualiza usuário
    const { data: userRes, error: userErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (userErr && !userErr.message.includes("already registered")) {
      throw userErr;
    }

    const userId =
      userRes?.user?.id ??
      (
        await supabaseAdmin.auth.admin.listUsers({ email })
      ).data.users[0].id;

    // 2) limpa roles antigas
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // 3) aplica novas roles
    for (const roleName of roles) {
      const { data: role } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("name", roleName)
        .single();

      if (role) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role_id: role.id,
        });
      }
    }

    // 4) vincula equipe ↔ user
    await supabaseAdmin
      .from("equipe")
      .update({ user_id: userId })
      .eq("id", equipe_id);

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
