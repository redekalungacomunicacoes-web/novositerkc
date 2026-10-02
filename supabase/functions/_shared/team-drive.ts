import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureDrivePath, trashDriveFile, uploadDriveFile } from "./google-drive.ts";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function requireTeamEditor(memberId: string, user: SupabaseClient) {
  const { data: admin } = await user.rpc("is_team_admin");
  if (admin === true) return;
  const { data: member } = await user.from("equipe").select("id,user_id").eq("id", memberId).maybeSingle();
  const { data: auth } = await user.auth.getUser();
  if (!member || !auth.user || member.user_id !== auth.user.id) throw new Error("Sem permissão para editar este integrante.");
}

async function teamFolder(memberId: string, rootId: string, admin: SupabaseClient) {
  const { data: member, error } = await admin.from("equipe").select("id,nome,drive_folder_id").eq("id", memberId).single();
  if (error || !member) throw new Error("Integrante não encontrado.");
  let memberFolder = member.drive_folder_id as string | null;
  if (!memberFolder) {
    const path = await ensureDrivePath(rootId, ["04_EQUIPE", String(member.nome || "Integrante")]);
    memberFolder = path.folderId;
    const { error: updateError } = await admin.from("equipe").update({ drive_folder_id: memberFolder }).eq("id", memberId);
    if (updateError) throw updateError;
  }
  return { member, memberFolder, profileFolder: (await ensureDrivePath(memberFolder, ["PERFIL"])).folderId };
}

async function commitAvatar(file: File, memberId: string, kind: "avatar" | "thumb", rootId: string, admin: SupabaseClient, actor: string) {
  const { memberFolder, profileFolder } = await teamFolder(memberId, rootId, admin);
  const targetName = kind === "thumb" ? "avatar-thumb.webp" : `avatar-original.${(file.name.split(".").pop() || "bin").toLowerCase()}`;
  const normalized = new File([await file.arrayBuffer()], targetName, { type: file.type || "application/octet-stream" });
  const uploaded = await uploadDriveFile(normalized, profileFolder);
  let row: any = null;
  try {
    const slug = `team-${memberId}-${kind}-${crypto.randomUUID()}`;
    const inserted = await admin.from("drive_files").insert({
      drive_file_id: uploaded.id, drive_folder_id: profileFolder, name: uploaded.name || targetName,
      mime_type: uploaded.mimeType || normalized.type || null, size_bytes: Number(uploaded.size || normalized.size),
      module: "team", entity_id: memberId, category: kind, uploaded_by: actor,
      web_view_link: uploaded.webViewLink || null, visibility: "public", public_slug: slug, status: "active"
    }).select("*").single();
    if (inserted.error || !inserted.data) throw inserted.error || new Error("Metadados do avatar não confirmados.");
    row = inserted.data;
    const column = kind === "thumb" ? "avatar_thumb_drive_file_id" : "avatar_drive_file_id";
    const previous = await admin.from("equipe").select(column).eq("id", memberId).single();
    const previousData = previous.data as Record<string, string | null> | null;
    const oldId = previousData?.[column] || null;
    const linked = await admin.from("equipe").update({ drive_folder_id: memberFolder, [column]: row.id }).eq("id", memberId).select("id").single();
    if (linked.error) throw linked.error;
    if (oldId && oldId !== row.id) await admin.from("drive_files").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", oldId);
    return row;
  } catch (error) {
    await trashDriveFile(uploaded.id).catch(() => {});
    if (row?.id) await admin.from("drive_files").delete().eq("id", row.id);
    throw error;
  }
}

export async function uploadTeamAvatar(form: FormData, rootId: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  const memberId = String(form.get("member_id") || "");
  const kind = String(form.get("kind") || "") as "avatar" | "thumb";
  const file = form.get("file");
  if (!uuid(memberId) || !["avatar","thumb"].includes(kind) || !(file instanceof File)) throw new Error("Integrante, tipo e arquivo são obrigatórios.");
  if (!file.type.startsWith("image/")) throw new Error("O avatar precisa ser uma imagem.");
  if (file.size > 25 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 25 MB.");
  await requireTeamEditor(memberId, user);
  return await commitAvatar(file, memberId, kind, rootId, admin, actor);
}

export async function importLegacyTeamAvatar(memberId: string, rootId: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  if (!uuid(memberId)) throw new Error("Integrante inválido.");
  await requireTeamEditor(memberId, user);
  const { data: member, error } = await admin.from("equipe").select("id,avatar_path,avatar_thumb_path").eq("id", memberId).single();
  if (error || !member) throw new Error("Integrante não encontrado.");
  const results: Record<string, unknown> = {};
  for (const [kind, path] of [["avatar", member.avatar_path], ["thumb", member.avatar_thumb_path]] as const) {
    if (!path) continue;
    const downloaded = await admin.storage.from("team-avatars").download(path);
    if (downloaded.error || !downloaded.data) throw downloaded.error || new Error("Arquivo legado não encontrado.");
    const mime = downloaded.data.type || (kind === "thumb" ? "image/webp" : "image/jpeg");
    const ext = path.split(".").pop() || (kind === "thumb" ? "webp" : "jpg");
    const file = new File([await downloaded.data.arrayBuffer()], kind === "thumb" ? "avatar-thumb.webp" : `avatar-original.${ext}`, { type: mime });
    results[kind] = await commitAvatar(file, memberId, kind, rootId, admin, actor);
  }
  return results;
}
