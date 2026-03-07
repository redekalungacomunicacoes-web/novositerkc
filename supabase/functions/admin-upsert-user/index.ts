/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  equipe_id: string;
  email: string;
  password?: string;
  roles?: string[];
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

    const body: Payload = await req.json();
    const { equipe_id, email, password, roles = [] } = body;

    if (!equipe_id) throw new Error("equipe_id é obrigatório");
    if (!email) throw new Error("email é obrigatório");
    if (password && String(password).length < 6) {
      throw new Error("password deve ter no mínimo 6 caracteres");
    }

    const normalizedEmail = email.trim().toLowerCase();

    let userId: string | null = null;

    const listRes = await admin.auth.admin.listUsers();
    if (listRes.error) throw listRes.error;

    const existingUser = (listRes.data.users || []).find(
      (u) => (u.email || "").toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      userId = existingUser.id;

      if (password) {
        const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
          email: normalizedEmail,
          password,
          email_confirm: true,
        });
        if (updateErr) throw updateErr;
      }
    } else {
      if (!password) {
        throw new Error("Usuário não existe ainda. Informe uma senha para criar o acesso.");
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });

      if (createErr) throw createErr;
      userId = created.user?.id || null;
    }

    if (!userId) throw new Error("Não foi possível resolver o user_id");

    const { error: equipeErr } = await admin
      .from("equipe")
      .update({
        user_id: userId,
        email_login: normalizedEmail,
      })
      .eq("id", equipe_id);

    if (equipeErr) throw new Error(`Falha ao atualizar equipe: ${equipeErr.message}`);

    const { error: delErr } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (delErr) throw new Error(`Falha ao limpar roles: ${delErr.message}`);

    if (roles.length) {
      const { data: roleRows, error: rolesErr } = await admin
        .from("roles")
        .select("id,name")
        .in("name", roles);

      if (rolesErr) throw new Error(`Falha ao buscar roles: ${rolesErr.message}`);

      const inserts = (roleRows || []).map((r) => ({
        user_id: userId!,
        role_id: r.id,
      }));

      if (inserts.length) {
        const { error: urErr } = await admin.from("user_roles").insert(inserts);
        if (urErr) throw new Error(`Falha ao gravar user_roles: ${urErr.message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Erro interno" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
