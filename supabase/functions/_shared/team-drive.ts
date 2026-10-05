import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureDrivePath, trashDriveFile, uploadDriveFile, downloadDriveFile } from "./google-drive.ts";

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function requireTeamEditor(memberId: string, user: SupabaseClient) {
  const { data: admin } = await user.rpc("is_team_admin");
  if (admin === true) return;
  const { data: member } = await user.from("equipe").select("id,user_id").eq("id", memberId).maybeSingle();
  const { data: auth } = await user.auth.getUser();
  if (!member || !auth.user || member.user_id !== auth.user.id) throw new Error("Sem permissão para editar este integrante.");
}

async function teamFolder(memberId: string, rootId: string, admin: SupabaseClient) {
  if (rootId !== "1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD") throw new Error("Drive institucional RKC obrigatório.");
  const { data: member, error } = await admin.from("equipe").select("id,nome,drive_folder_id").eq("id", memberId).single();
  if (error || !member) throw new Error("Integrante não encontrado.");
  let memberFolder = member.drive_folder_id as string | null;
  if (!memberFolder) {
    const path = await ensureDrivePath(rootId, ["04_EQUIPE", String(member.nome || "Integrante")]);
    memberFolder = path.folderId;
    const { error: updateError } = await admin.from("equipe").update({ drive_folder_id: memberFolder }).eq("id", memberId);
    if (updateError) throw updateError;
  }
  if (rootId !== "1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD") throw new Error("Drive institucional RKC obrigatório.");
  const folders: Record<string, string> = {};
  for (const name of ["PERFIL", "PORTFOLIO", "DOCUMENTOS", "TAREFAS"]) folders[name] = (await ensureDrivePath(memberFolder, [name])).folderId;
  return { member, memberFolder, profileFolder: folders.PERFIL, portfolioFolder: folders.PORTFOLIO };
}

function avatarExtension(file: File, kind: "avatar" | "thumb") {
  const mime = (file.type || "").toLowerCase();
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  if (byMime[mime]) return byMime[mime];
  if (kind === "thumb") return "webp";
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "bin";
}

function avatarTargetName(file: File, kind: "avatar" | "thumb") {
  return kind === "thumb" ? "avatar-thumb.webp" : `avatar-original.${avatarExtension(file, kind)}`;
}

async function validateAvatar(file: File, thumb = false) {
  const bytes = new Uint8Array(await file.slice(0,32).arrayBuffer());
  const ascii = (start: number,end: number) => String.fromCharCode(...bytes.slice(start,end));
  const detected = bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff ? "image/jpeg"
    : bytes[0]===0x89 && ascii(1,4)==="PNG" ? "image/png"
    : ascii(0,4)==="RIFF" && ascii(8,12)==="WEBP" ? "image/webp"
    : ["GIF87a","GIF89a"].includes(ascii(0,6)) ? "image/gif"
    : ascii(4,8)==="ftyp" && ["avif","avis"].includes(ascii(8,12)) ? "image/avif" : null;
  if(!detected || detected !== file.type || (thumb && detected !== "image/webp")) throw new Error("Conteúdo da imagem incompatível com o MIME informado. Thumbnail deve ser WebP real.");
}
async function identicalDriveFile(file: File, row: any) {
  if (!row || row.size_bytes !== file.size || row.mime_type !== file.type || row.status !== "active") return false;
  try {
    const current=await downloadDriveFile(row.drive_file_id);
    const a=new Uint8Array(await crypto.subtle.digest("SHA-256",await current.arrayBuffer()));
    const b=new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()));
    return a.every((value,index)=>value===b[index]);
  } catch {return false;}
}

async function commitAvatar(file: File, memberId: string, kind: "avatar" | "thumb", rootId: string, admin: SupabaseClient, actor: string) {
  await validateAvatar(file,kind === "thumb");
  const { memberFolder, profileFolder } = await teamFolder(memberId, rootId, admin);
  const targetName = avatarTargetName(file, kind);
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

type StagedAvatar = { row: any; driveFileId: string };

async function stageAvatar(file: File, memberId: string, kind: "avatar" | "thumb", profileFolder: string, admin: SupabaseClient, actor: string): Promise<StagedAvatar> {
  const targetName = avatarTargetName(file, kind);
  const normalized = new File([await file.arrayBuffer()], targetName, { type: file.type || "application/octet-stream" });
  const uploaded = await uploadDriveFile(normalized, profileFolder);
  try {
    const inserted = await admin.from("drive_files").insert({
      drive_file_id: uploaded.id,
      drive_folder_id: profileFolder,
      name: uploaded.name || targetName,
      mime_type: uploaded.mimeType || normalized.type || null,
      size_bytes: Number(uploaded.size || normalized.size),
      module: "team",
      entity_id: memberId,
      category: kind,
      uploaded_by: actor,
      web_view_link: uploaded.webViewLink || null,
      visibility: "public",
      public_slug: `team-${memberId}-${kind}-${crypto.randomUUID()}`,
      status: "active",
    }).select("*").single();
    if (inserted.error || !inserted.data) throw inserted.error || new Error("Metadados do avatar não confirmados.");
    return { row: inserted.data, driveFileId: uploaded.id };
  } catch (error) {
    await trashDriveFile(uploaded.id).catch(() => {});
    throw error;
  }
}

async function cleanupStagedAvatar(staged: StagedAvatar | null, admin: SupabaseClient) {
  if (!staged) return;
  const deleted = await admin.from("drive_files").delete().eq("id", staged.row.id);
  if (deleted.error) {
    await admin.from("drive_files").update({
      status: "archived",
      updated_at: new Date().toISOString(),
    }).eq("id", staged.row.id);
  }
  await trashDriveFile(staged.driveFileId).catch(() => {});
}

export async function ensureTeamMemberFolder(memberId: string, rootId: string, user: SupabaseClient, admin: SupabaseClient) {
  if (!uuid(memberId)) throw new Error("Integrante inválido.");
  await requireTeamEditor(memberId, user);
  const { memberFolder } = await teamFolder(memberId, rootId, admin);
  return { memberId, driveFolderId: memberFolder };
}

export async function uploadTeamAvatarPair(form: FormData, rootId: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  const memberId = String(form.get("member_id") || "");
  const avatar = form.get("avatar");
  const thumb = form.get("thumb");
  if (!uuid(memberId) || !(avatar instanceof File) || !(thumb instanceof File)) throw new Error("Integrante, avatar e thumbnail são obrigatórios.");
  for (const file of [avatar, thumb]) {
    if (!file.type.startsWith("image/")) throw new Error("Avatar e thumbnail precisam ser imagens.");
    if (file.size > 25 * 1024 * 1024) throw new Error("Cada imagem deve ter no máximo 25 MB.");
  }
  await validateAvatar(avatar);
  await validateAvatar(thumb,true);
  if (thumb.type !== "image/webp") throw new Error("A thumbnail precisa ser WebP real.");
  await requireTeamEditor(memberId, user);

  const { memberFolder, profileFolder } = await teamFolder(memberId, rootId, admin);
  const previous = await admin.from("equipe")
    .select("avatar_drive_file_id,avatar_thumb_drive_file_id")
    .eq("id", memberId).single();
  if (previous.error) throw previous.error;

  const existingIds=[previous.data?.avatar_drive_file_id,previous.data?.avatar_thumb_drive_file_id].filter(Boolean);
  if(existingIds.length===2) {
    const current=await admin.from("drive_files").select("*").in("id",existingIds);
    if(current.error) throw current.error;
    const oldAvatar=current.data?.find((r:any)=>r.id===previous.data.avatar_drive_file_id);
    const oldThumb=current.data?.find((r:any)=>r.id===previous.data.avatar_thumb_drive_file_id);
    if(await identicalDriveFile(avatar,oldAvatar) && await identicalDriveFile(thumb,oldThumb)) return {avatar:oldAvatar,thumb:oldThumb};
  }
  let stagedAvatar: StagedAvatar | null = null;
  let stagedThumb: StagedAvatar | null = null;
  try {
    stagedAvatar = await stageAvatar(avatar, memberId, "avatar", profileFolder, admin, actor);
    stagedThumb = await stageAvatar(thumb, memberId, "thumb", profileFolder, admin, actor);

    const linked = await admin.from("equipe").update({
      drive_folder_id: memberFolder,
      avatar_drive_file_id: stagedAvatar.row.id,
      avatar_thumb_drive_file_id: stagedThumb.row.id,
      foto_url: null, avatar_path: null, avatar_thumb_path: null,
    }).eq("id", memberId).select("id").single();
    if (linked.error) throw linked.error;
  } catch (error) {
    await cleanupStagedAvatar(stagedThumb, admin);
    await cleanupStagedAvatar(stagedAvatar, admin);
    throw error;
  }

  const oldIds = [
    previous.data?.avatar_drive_file_id,
    previous.data?.avatar_thumb_drive_file_id,
  ].filter((id): id is string => Boolean(id) && id !== stagedAvatar!.row.id && id !== stagedThumb!.row.id);

  if (oldIds.length) {
    const archived = await admin.from("drive_files").update({
      status: "archived",
      updated_at: new Date().toISOString(),
    }).in("id", oldIds);
    if (archived.error) console.error("[team-avatar-pair] previous metadata archive failed", archived.error);
  }

  return { avatar: stagedAvatar.row, thumb: stagedThumb.row };
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
    const pathExt = (path.split(".").pop() || "").toLowerCase();
    const mimeByExt: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
    };
    const mime = mimeByExt[pathExt] || downloaded.data.type || (kind === "thumb" ? "image/webp" : "image/jpeg");
    const ext = kind === "thumb" ? "webp" : (pathExt || avatarExtension(new File([], "avatar", { type: mime }), "avatar"));
    const file = new File([await downloaded.data.arrayBuffer()], kind === "thumb" ? "avatar-thumb.webp" : `avatar-original.${ext}`, { type: mime });
    results[kind] = await commitAvatar(file, memberId, kind, rootId, admin, actor);
  }
  return results;
}

export async function uploadTeamPortfolio(form: FormData, rootId: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  const memberId = String(form.get("member_id") || "");
  const kind = String(form.get("kind") || "");
  const file = form.get("file");
  if (!uuid(memberId) || !(file instanceof File) || !["image","video","pdf"].includes(kind)) throw new Error("Arquivo de portfólio inválido.");
  if (file.size > 50*1024*1024) throw new Error("O limite por arquivo é 50 MB.");
  if (!(kind === "image" ? file.type.startsWith("image/") : kind === "video" ? file.type.startsWith("video/") : file.type === "application/pdf")) throw new Error("Tipo do arquivo incompatível.");
  await requireTeamEditor(memberId, user);
  const {portfolioFolder} = await teamFolder(memberId, rootId, admin);
  const uploaded = await uploadDriveFile(file, portfolioFolder);
  let record: any = null;
  try {
    const inserted = await admin.from("drive_files").insert({drive_file_id:uploaded.id,drive_folder_id:portfolioFolder,name:uploaded.name||file.name,mime_type:file.type,size_bytes:file.size,module:"team",entity_id:memberId,category:"portfolio",visibility:"public",status:"active",public_slug:`team-portfolio-${crypto.randomUUID()}`,uploaded_by:actor}).select("*").single();
    if (inserted.error) throw inserted.error;
    record=inserted.data;
    const count = await admin.from("team_member_portfolio").select("id",{count:"exact",head:true}).eq("member_id",memberId);
    if(count.error) throw count.error;
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-media?id=${encodeURIComponent(record.public_slug)}`;
    const item = await admin.from("team_member_portfolio").insert({member_id:memberId,kind,title:String(form.get("title")||"")||null,description:String(form.get("description")||"")||null,file_url:url,thumb_url:kind==="image"?url:null,drive_file_id:record.id,is_public:true,order_index:count.count||0}).select("*").single();
    if(item.error) throw item.error;
    return item.data;
  } catch(error) {
    if(record) await admin.from("drive_files").update({status:"archived"}).eq("id",record.id);
    await trashDriveFile(uploaded.id).catch(()=>{});
    throw error;
  }
}
export async function removeTeamAvatar(memberId: string, user: SupabaseClient, admin: SupabaseClient) {
  await requireTeamEditor(memberId,user);
  const old=await admin.from("equipe").select("avatar_drive_file_id,avatar_thumb_drive_file_id").eq("id",memberId).single();
  if(old.error) throw old.error;
  const result=await admin.from("equipe").update({avatar_drive_file_id:null,avatar_thumb_drive_file_id:null,avatar_path:null,avatar_thumb_path:null,foto_url:null}).eq("id",memberId);
  if(result.error) throw result.error;
  const ids=[old.data.avatar_drive_file_id,old.data.avatar_thumb_drive_file_id].filter(Boolean);
  if(ids.length) {const archived=await admin.from("drive_files").update({status:"archived"}).in("id",ids);if(archived.error) throw archived.error;}
}
export async function removeTeamPortfolio(id: string,user: SupabaseClient,admin: SupabaseClient) {
  const item=await admin.from("team_member_portfolio").select("member_id,drive_file_id").eq("id",id).single();
  if(item.error) throw item.error;
  await requireTeamEditor(item.data.member_id,user);
  const deleted=await admin.from("team_member_portfolio").delete().eq("id",id);
  if(deleted.error) throw deleted.error;
  if(item.data.drive_file_id) {const result=await admin.from("drive_files").update({status:"archived"}).eq("id",item.data.drive_file_id);if(result.error) throw result.error;}
}

// Called only after the editor has decoded both newly linked images.
export async function confirmTeamAvatar(memberId: string, avatarId: string, thumbId: string, user: SupabaseClient, admin: SupabaseClient) {
  await requireTeamEditor(memberId,user);
  const member=await admin.from("equipe").select("avatar_drive_file_id,avatar_thumb_drive_file_id").eq("id",memberId).single();
  if(member.error) throw member.error;
  if(member.data.avatar_drive_file_id!==avatarId || member.data.avatar_thumb_drive_file_id!==thumbId) return {cleanup_pending:true};
  const current=await admin.from("drive_files").select("*").in("id",[avatarId,thumbId]).eq("status","active").eq("entity_id",memberId).eq("module","team");
  if(current.error || current.data?.length!==2) throw new Error("Par de avatar não confirmado.");
  for(const file of current.data) {
    const response=await downloadDriveFile(file.drive_file_id);
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==file.size_bytes) throw new Error("Cópia Drive incompleta; limpeza cancelada.");
  }
  const old=await admin.from("drive_files").select("id,drive_file_id").eq("module","team").eq("entity_id",memberId).eq("status","archived").in("category",["avatar","thumb"]);
  if(old.error) throw old.error;
  let pending=false;
  for(const file of old.data||[]) {
    try {
      await trashDriveFile(file.drive_file_id);
      const updated=await admin.from("drive_files").update({status:"trashed",deleted_at:new Date().toISOString()}).eq("id",file.id);
      if(updated.error) throw updated.error;
    } catch {pending=true;}
  }
  return {cleanup_pending:pending};
}
