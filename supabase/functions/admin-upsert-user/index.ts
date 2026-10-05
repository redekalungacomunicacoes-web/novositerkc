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

type AuthUser = {
  id: string;
  email?: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findAuthUserByEmail(admin: ReturnType<typeof createClient>, normalizedEmail: string) {
  let page = 1;

  while (true) {
    const res = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (res.error) {
      return { user: null, error: `Falha ao listar usuários auth: ${res.error.message}` };
    }

    const users = (res.data.users || []) as AuthUser[];
    const match = users.find((u) => (u.email || "").trim().toLowerCase() === normalizedEmail);
    if (match) return { user: match, error: null };

    if (users.length < 1000) return { user: null, error: null };
    page += 1;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Método não permitido." }, 405);
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

    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Autenticação obrigatória." }, 401);
    const { data: caller, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller.user) return json({ ok: false, error: "Sessão inválida." }, 401);
    const { data: callerRoles, error: callerRolesError } = await admin.from("user_roles")
      .select("roles(name)").eq("user_id", caller.user.id);
    const callerNames = (callerRoles || []).flatMap((row: any) => {
      const role = row.roles; return Array.isArray(role) ? role.map((r: any) => r.name) : [role?.name];
    });
    if (callerRolesError || !callerNames.some((role: string) => ["admin", "admin_alfa"].includes(role))) {
      return json({ ok: false, error: "Permissão administrativa obrigatória." }, 403);
    }
    const body: Payload = await req.json();
    const equipe_id = body?.equipe_id;
    const password = body?.password?.trim();
    const normalizedEmail = (body?.email || "").trim().toLowerCase();
    const normalizedRoles = [...new Set((body?.roles || []).map((r) => String(r).trim().toLowerCase()).filter(Boolean))];

    if (!equipe_id) return json({ ok: false, error: "equipe_id é obrigatório." }, 400);
    if (!normalizedEmail) return json({ ok: false, error: "email é obrigatório." }, 400);
    if (password && password.length < 6) {
      return json({ ok: false, error: "password deve ter no mínimo 6 caracteres." }, 400);
    }

    const { data: equipeAtual, error: equipeAtualErr } = await admin
      .from("equipe")
      .select("id,nome,user_id,email_login")
      .eq("id", equipe_id)
      .maybeSingle();

    if (equipeAtualErr) {
      return json({ ok: false, error: `Falha ao buscar integrante: ${equipeAtualErr.message}` }, 400);
    }

    if (!equipeAtual) {
      return json({ ok: false, error: "Integrante não encontrado na tabela equipe." }, 404);
    }

    const { data: emailOwner, error: emailOwnerErr } = await admin
      .from("equipe")
      .select("id,nome,email_login,user_id")
      .eq("email_login", normalizedEmail)
      .neq("id", equipe_id)
      .maybeSingle();

    if (emailOwnerErr) {
      return json({ ok: false, error: `Falha ao verificar email_login: ${emailOwnerErr.message}` }, 400);
    }

    if (emailOwner) {
      return json(
        {
          ok: false,
          error: `Este email de login já está vinculado ao integrante \"${emailOwner.nome}\" (id: ${emailOwner.id}).`,
        },
        409,
      );
    }

    const { data: roleRows, error: rolesErr } = await admin.from("roles").select("id,name").in("name", normalizedRoles);
    if (rolesErr) return json({ ok: false, error: "Falha ao validar permissões." }, 400);
    const foundNames = new Set((roleRows || []).map((r) => r.name));
    if (normalizedRoles.some((role) => !foundNames.has(role))) return json({ ok: false, error: "Permissão inexistente." }, 400);
    if (normalizedRoles.includes("admin_alfa") && !callerNames.includes("admin_alfa")) {
      return json({ ok: false, error: "Somente admin_alfa pode atribuir esta permissão." }, 403);
    }
    if (equipeAtual.user_id) {
      const { data: targetRoles, error: targetError } = await admin.from("user_roles").select("roles(name)").eq("user_id", equipeAtual.user_id);
      const isAlfa = (targetRoles || []).some((row: any) => Array.isArray(row.roles) ? row.roles.some((r: any) => r.name === "admin_alfa") : row.roles?.name === "admin_alfa");
      if (targetError) return json({ ok: false, error: "Falha ao validar permissões atuais." }, 400);
      if (isAlfa && !callerNames.includes("admin_alfa")) return json({ ok: false, error: "Somente admin_alfa pode alterar este acesso." }, 403);
    }

    const foundUser = await findAuthUserByEmail(admin, normalizedEmail);
    if (foundUser.error) return json({ ok: false, error: foundUser.error }, 400);

    if (equipeAtual.user_id && foundUser.user && foundUser.user.id !== equipeAtual.user_id) {
      return json({ ok: false, error: "Email pertence a outro usuário." }, 409);
    }
    let userId = equipeAtual.user_id || foundUser.user?.id || null;

    if (!userId) {
      if (!password) {
        return json(
          {
            ok: false,
            error: "Usuário não existe no Auth. Informe uma senha para criar o acesso.",
          },
          400,
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
    } else {
      const updatePayload: { email?: string; password?: string; email_confirm?: boolean } = {
        email: normalizedEmail,
        email_confirm: true,
      };

      if (password) updatePayload.password = password;

      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, updatePayload);
      if (updateErr) {
        return json({ ok: false, error: `Falha ao atualizar usuário auth: ${updateErr.message}` }, 400);
      }
    }

    if (!userId) return json({ ok: false, error: "Não foi possível resolver o user_id." }, 500);

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

    const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (delErr) {
      return json({ ok: false, error: `Falha ao limpar roles: ${delErr.message}` }, 400);
    }

    if (normalizedRoles.length) {
      const inserts = (roleRows || []).map((r) => ({
        user_id: userId,
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
