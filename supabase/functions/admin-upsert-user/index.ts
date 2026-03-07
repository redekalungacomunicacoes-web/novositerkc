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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Variáveis do Supabase não configuradas." }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body: Payload = await req.json();
    const { equipe_id, email, password, roles = [] } = body;

    if (!equipe_id) return json({ ok: false, error: "equipe_id é obrigatório" }, 400);
    if (!email) return json({ ok: false, error: "email é obrigatório" }, 400);
    if (password && String(password).length < 6) {
      return json({ ok: false, error: "password deve ter no mínimo 6 caracteres" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRoles = [...new Set((roles || []).map((r) => String(r).trim().toLowerCase()).filter(Boolean))];

    let userId: string | null = null;

    const listRes = await admin.auth.admin.listUsers();
    if (listRes.error) {
      return json({ ok: false, error: `Falha ao listar usuários: ${listRes.error.message}` }, 400);
    }

    const existingUser = (listRes.data.users || []).find(
      (u) => (u.email || "").trim().toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      userId = existingUser.id;

      const updatePayload: { email?: string; password?: string; email_confirm?: boolean } = {
        email: normalizedEmail,
        email_confirm: true,
      };

      if (password) updatePayload.password = password;

      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, updatePayload);
      if (updateErr) {
        return json({ ok: false, error: `Falha ao atualizar usuário auth: ${updateErr.message}` }, 400);
      }
    } else {
      if (!password) {
        return json(
          { ok: false, error: "Usuário não existe ainda. Informe uma senha para criar o acesso." },
          400
        );
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });

      if (createErr) {
        return json({ ok: false, error: `Falha ao criar usuário auth: ${createErr.message}` }, 400);
      }

      userId = created.user?.id || null;
    }

    if (!userId) {
      return json({ ok: false, error: "Não foi possível resolver o user_id" }, 400);
    }

    const { data: equipeRow, error: equipeFindErr } = await admin
      .from("equipe")
      .select("id,user_id,email_login,nome")
      .eq("id", equipe_id)
      .single();

    if (equipeFindErr || !equipeRow) {
      return json({ ok: false, error: "Integrante não encontrado na tabela equipe." }, 404);
    }

    const { error: equipeErr } = await admin
      .from("equipe")
      .update({
        user_id: userId,
        email_login: normalizedEmail,
      })
      .eq("id", equipe_id);

    if (equipeErr) {
      return json({ ok: false, error: `Falha ao atualizar equipe: ${equipeErr.message}` }, 400);
    }

    const { error: delErr } = await admin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (delErr) {
      return json({ ok: false, error: `Falha ao limpar roles: ${delErr.message}` }, 400);
    }

    if (normalizedRoles.length) {
      const { data: roleRows, error: rolesErr } = await admin
        .from("roles")
        .select("id,name")
        .in("name", normalizedRoles);

      if (rolesErr) {
        return json({ ok: false, error: `Falha ao buscar roles: ${rolesErr.message}` }, 400);
      }

      const foundNames = new Set((roleRows || []).map((r) => r.name));
      const missingRoles = normalizedRoles.filter((r) => !foundNames.has(r));

      if (missingRoles.length) {
        return json(
          { ok: false, error: `Roles não encontradas na tabela roles: ${missingRoles.join(", ")}` },
          400
        );
      }

      const inserts = (roleRows || []).map((r) => ({
        user_id: userId!,
        role_id: r.id,
        created_at: new Date().toISOString(),
      }));

      if (inserts.length) {
        const { error: urErr } = await admin.from("user_roles").insert(inserts);
        if (urErr) {
          return json({ ok: false, error: `Falha ao gravar user_roles: ${urErr.message}` }, 400);
        }
      }
    }

    return json({
      ok: true,
      user_id: userId,
      email: normalizedEmail,
      equipe_id,
      roles: normalizedRoles,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Erro interno" }, 500);
  }
});
