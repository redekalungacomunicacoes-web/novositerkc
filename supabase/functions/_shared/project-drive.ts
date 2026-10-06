import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureDrivePath, getDriveFolder, uploadDriveFile } from "./google-drive.ts";

const ROOT = "1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD";
const PROJECTS = "1qJCp9Qjq_PeKNkjJuAKgWiDJVEVMleCs";
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function requireProjectEditor(user: SupabaseClient, projectId: string) {
  if (!uuid(projectId)) throw new Error("Projeto inválido.");
  const role = await user.rpc("has_role", { required: ["admin_alfa", "admin", "editor"] });
  if (role.error || role.data !== true) throw new Error("Sem permissão para gerenciar mídias de projetos.");
  const project = await user.from("projetos").select("id,slug").eq("id",projectId).maybeSingle();
  if (project.error || !project.data) throw new Error("Projeto indisponível.");
  return project.data;
}
function validImage(bytes: Uint8Array, mime: string) {
  if(mime==="image/jpeg") return bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if(mime==="image/png") return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  if(mime==="image/webp") return new TextDecoder().decode(bytes.slice(0,4))==="RIFF" && new TextDecoder().decode(bytes.slice(8,12))==="WEBP";
  if(mime==="image/gif") return ["GIF87a","GIF89a"].includes(new TextDecoder().decode(bytes.slice(0,6)));
  if(mime==="image/avif") return new TextDecoder().decode(bytes.slice(4,16)).includes("ftypavif");
  return false;
}
async function projectFolder(projectId: string, admin: SupabaseClient) {
  const lease = crypto.randomUUID();
  const claim = await admin.rpc("claim_project_drive_folder",{p_project_id:projectId,p_token:lease});
  if(claim.error || claim.data!==true) throw new Error("Outro envio está preparando a pasta. Aguarde e tente novamente.");
  try {
    const project=await admin.from("projetos").select("drive_folder_id,slug").eq("id",projectId).single();
    if(project.error) throw project.error;
    let folderId=project.data.drive_folder_id;
    if(!folderId) {
      const segment=(project.data.slug || projectId)+"__"+projectId;
      folderId=(await ensureDrivePath(PROJECTS,[segment])).folderId;
      const saved=await admin.from("projetos").update({drive_folder_id:folderId}).eq("id",projectId);
      if(saved.error) throw saved.error;
    }
    const folder=await getDriveFolder(folderId);
    if(!folder.parents?.includes(PROJECTS)) throw new Error("Pasta fora de 03_PROJETOS.");
    return folderId as string;
  } finally {
    await admin.from("project_drive_leases").delete().eq("project_id",projectId).eq("token",lease);
  }
}
export async function uploadProjectDrive(form: FormData, root: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  if(root!==ROOT) throw new Error("Drive institucional RKC obrigatório.");
  const projectId=String(form.get("project_id")||"");
  const category=String(form.get("category")||"");
  const file=form.get("file");
  await requireProjectEditor(user,projectId);
  if(!["cover","cover_card","gallery"].includes(category) || !(file instanceof File)) throw new Error("Upload de projeto inválido.");
  if(!file.size || file.size>25*1024*1024 || !validImage(new Uint8Array(await file.slice(0,16).arrayBuffer()),file.type))
    throw new Error("Envie uma imagem JPEG, PNG, WebP, GIF ou AVIF válida de até 25 MB.");
  const folderId=await projectFolder(projectId,admin);
  const name=file.name.replace(/[\\/\r\n"]/g,"_").slice(0,180)||"imagem";
  const uploaded=await uploadDriveFile(new File([file],name,{type:file.type}),folderId);
  if(Number(uploaded.size)!==file.size) throw new Error("O Drive não confirmou o tamanho do arquivo.");
  const record=await admin.from("drive_files").insert({
    drive_file_id:uploaded.id,drive_folder_id:folderId,name,mime_type:file.type,size_bytes:file.size,
    module:"projetos",entity_id:projectId,category,visibility:"public",status:"active",
    public_slug:"projeto-"+crypto.randomUUID(),uploaded_by:actor,access_scope:"public"
  }).select("id,public_slug,name,mime_type,size_bytes").single();
  // Preserve an uploaded file if registration fails; never delete an uncertain upload.
  if(record.error) throw record.error;
  return {...record.data,url:Deno.env.get("SUPABASE_URL")+"/functions/v1/drive-media?id="+record.data.public_slug};
}
export async function getProjectPreview(slug: string,user: SupabaseClient,admin: SupabaseClient) {
  const file=await admin.from("drive_files").select("drive_file_id,entity_id,mime_type").eq("module","projetos")
    .eq("public_slug",slug).eq("status","active").is("deleted_at",null).maybeSingle();
  if(file.error || !file.data) throw new Error("Arquivo indisponível.");
  await requireProjectEditor(user,file.data.entity_id);
  return file.data;
}
