/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { equipe_id, email, password, roles } = await req.json();

    if (!equipe_id) throw new Error("equipe_id é obrigatório");
    if (!email) throw new Error("email é obrigatório");
    if (!password || String(password).length < 6) {
      throw new Error("password deve ter no mínimo 6 caracteres");
    }

    // 1) cria usuário no Auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      // Se usuário já existe, tenta localizar por email e seguir
      // (alguns projetos preferem updateUserById, mas precisa do ID)
      // Aqui fazemos um fallback simples via tabela auth.users não é acessível.
      throw new Error(`Falha ao criar usuário: ${createErr.message}`);
    }

    const user_id = created.user?.id;
    if (!user_id) throw new Error("Não foi possível obter user_id do Auth");

    // 2) vincula equipe -> auth.users
    const { error: linkErr } = await admin
      .from("equipe")
      .update({ user_id, email_login: email })
      .eq("id", equipe_id);

    if (linkErr) throw new Error(`Falha ao vincular equipe: ${linkErr.message}`);

    // 3) aplica roles (roles[] = ["admin","editor","autor"])
    const roleNames: string[] = Array.isArray(roles) ? roles : [];

    if (roleNames.length) {
      // pega IDs das roles
      const { data: roleRows, error: rolesErr } = await admin
        .from("roles")
        .select("id,name")
        .in("name", roleNames);

      if (rolesErr) throw new Error(`Falha ao buscar roles: ${rolesErr.message}`);

      const roleIds = (roleRows || []).map((r) => r.id);

      if (roleIds.length) {
        // limpa roles atuais do usuário e insere as novas (simples e consistente)
        await admin.from("user_roles").delete().eq("user_id", user_id);

        const inserts = roleIds.map((role_id) => ({ user_id, role_id }));
        const { error: urErr } = await admin.from("user_roles").insert(inserts);
        if (urErr) throw new Error(`Falha ao gravar user_roles: ${urErr.message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, user_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Erro" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
