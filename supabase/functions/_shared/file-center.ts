import { createDriveFolder, ensureDrivePath, getDriveFileMetadata, listDriveChildren, moveDriveFile, renameDriveFile, trashDriveFile, uploadDriveFile } from "./google-drive.ts";
import { prepareTaskFolder } from "./task-drive.ts";
type Client = any;
export function cleanFolderName(value: unknown) {
 const name=String(value ?? "").replace(/[\\/\r\n"]/g,"_").trim();
 if (!name || name.length>120) throw new Error("Informe um nome de pasta entre 1 e 120 caracteres.");
 return name;
}
export async function requireCenterFolder(id: string, user: Client, admin: Client, actor: string, write = false) {
 const {data:folder,error}=await user.from("file_center_folders").select("*").eq("id",id).maybeSingle();
 if(error || !folder) throw new Error("Pasta não encontrada ou sem acesso.");
 if(write && folder.owner_user_id!==actor){
  const role=await user.rpc("is_team_admin");
  if(role.error || role.data!==true) throw new Error("Sem permissão para alterar esta pasta.");
 }
 return folder;
}
async function requireFile(id: string,user: Client,actor: string) {
 const result=await user.from("drive_files").select("*").eq("id",id).eq("status","active").maybeSingle();
 if(result.error || !result.data || !["tasks","file-center"].includes(result.data.module)) throw new Error("Arquivo não encontrado ou sem acesso.");
 if(result.data.uploaded_by!==actor){
  const role=await user.rpc("is_team_admin");
  if(role.error || role.data!==true) throw new Error("Somente quem enviou ou um administrador pode gerenciar este arquivo.");
 }
 return result.data;
}
export async function withCenterLease(root: string,admin: Client,work:()=>Promise<any>){
 const key="central:"+root,token=crypto.randomUUID(),now=new Date().toISOString();
 const insert=await admin.from("task_drive_root_locks").upsert({root_folder_id:key,token,locked_at:now},{onConflict:"root_folder_id",ignoreDuplicates:true});
 if(insert.error)throw insert.error;
 const lease=await admin.from("task_drive_root_locks").update({token,locked_at:now}).eq("root_folder_id",key)
 .or(`token.eq.${token},locked_at.lt.${new Date(Date.now()-180000).toISOString()}`).select("token").maybeSingle();
 if(lease.error)throw lease.error;
 if(!lease.data)throw new Error("Outra operação está em andamento. Aguarde e tente novamente.");
 try{return await work();}finally{
  const released=await admin.from("task_drive_root_locks").update({locked_at:"1970-01-01T00:00:00Z"}).eq("root_folder_id",key).eq("token",token);
  if(released.error)console.error("[file-center] release",released.error);
 }
}
export async function createCenterFolder(body:any,root:string,user:Client,admin:Client,actor:string){
 const name=cleanFolderName(body.name);
 const parentId=String(body.parent_id || "") || null;
 let owner=actor,parentDrive:string;
 if(parentId){
  const parent=await requireCenterFolder(parentId,user,admin,actor,true);
  owner=parent.owner_user_id;parentDrive=parent.drive_folder_id;
 }else{
  const member=await admin.from("equipe").select("id,nome").eq("user_id",actor).eq("ativo",true).maybeSingle();
  if(member.error || !member.data)throw new Error("Seu usuário precisa de um cadastro ativo na equipe.");
  const path=await ensureDrivePath(root,["04_EQUIPE",cleanFolderName(member.data.nome || member.data.id),"CENTRAL_DE_ARQUIVOS"]);
  parentDrive=path.folderId;
 }
 const query=admin.from("file_center_folders").select("id").eq("owner_user_id",owner).eq("name",name);
 const previous=await (parentId?query.eq("parent_id",parentId):query.is("parent_id",null)).maybeSingle();
 if(previous.error)throw previous.error;
 if(previous.data)throw new Error("Já existe uma pasta com esse nome neste local.");
 const physical=await createDriveFolder(name,parentDrive);
 const result=await admin.from("file_center_folders").insert({name,parent_id:parentId,owner_user_id:owner,drive_folder_id:physical.id}).select("*").single();
 if(result.error){await trashDriveFile(physical.id).catch(console.error);throw result.error;}
 return result.data;
}
export async function uploadCenterFile(form:FormData,user:Client,admin:Client,actor:string){
 const file=form.get("file"),folderId=String(form.get("folder_id") || ""),upload=String(form.get("upload_id") || "");
 if(!(file instanceof File) || !folderId)throw new Error("Selecione uma pasta e um arquivo.");
 if(!/^[0-9a-f-]{36}$/i.test(upload))throw new Error("Identificador do envio inválido.");
 if(file.size>50*1024*1024)throw new Error("O limite por arquivo é 50 MB.");
 const folder=await requireCenterFolder(folderId,user,admin,actor,true);
 const find=()=>admin.from("drive_files").select("*").eq("uploaded_by",actor).eq("central_upload_id",upload).maybeSingle();
 const previous=await find();if(previous.error)throw previous.error;
 if(previous.data){
  if(previous.data.status!=="active" || previous.data.central_folder_id!==folderId)throw new Error("O envio anterior foi movido ou excluído.");
  return previous.data;
 }
 const physical=await uploadDriveFile(file,folder.drive_folder_id);
 const row={drive_file_id:physical.id,drive_folder_id:folder.drive_folder_id,central_folder_id:folderId,central_upload_id:upload,
 name:physical.name || file.name,mime_type:physical.mimeType || file.type || null,size_bytes:Number(physical.size || file.size),
 module:"file-center",uploaded_by:actor,visibility:"private",status:"active",category:"cobertura",web_view_link:physical.webViewLink || null};
 const result=await admin.from("drive_files").insert(row).select("*").single();
 if(result.error){
  await trashDriveFile(physical.id).catch(console.error);
  if(result.error.code==="23505"){const winner=await find();if(!winner.error && winner.data?.status==="active" && winner.data.central_folder_id===folderId)return winner.data;}
  throw result.error;
 }
 return result.data;
}
export async function moveCenterFile(body:any,root:string,user:Client,admin:Client,actor:string){
 const file=await requireFile(String(body.id || ""),user,actor);
 const folderId=String(body.folder_id || "") || null,taskId=String(body.task_id || "") || null;
 if(Boolean(folderId)===Boolean(taskId))throw new Error("Selecione uma pasta ou uma tarefa de destino.");
 let target:string,module:string;
 if(folderId){const folder=await requireCenterFolder(folderId,user,admin,actor,true);target=folder.drive_folder_id;module="file-center";}
 else{
  const task=await user.from("tasks").select("id").eq("id",taskId).maybeSingle();
  if(task.error || !task.data)throw new Error("Sem acesso à tarefa de destino.");
  target=await prepareTaskFolder(taskId!,root,admin);module="tasks";
 }
 const physical=await getDriveFileMetadata(file.drive_file_id);
 if(physical.trashed || !physical.parents?.includes(file.drive_folder_id))throw new Error("O arquivo mudou de pasta no Drive. Atualize antes de mover.");
 if(target===file.drive_folder_id)return file;
 await moveDriveFile(file.drive_file_id,target,file.drive_folder_id);
 const result=await admin.from("drive_files").update({module,task_id:taskId,entity_id:taskId,central_folder_id:folderId,drive_folder_id:target,visibility:"private",public_slug:null,updated_at:new Date().toISOString()})
 .eq("id",file.id).eq("drive_folder_id",file.drive_folder_id).eq("status","active").select("*").maybeSingle();
 if(result.error || !result.data){
  await moveDriveFile(file.drive_file_id,file.drive_folder_id,target).catch(error=>console.error("[file-center] move rollback",error));
  throw result.error || new Error("O arquivo foi alterado em outra sessão. Atualize a lista.");
 }
 return result.data;
}
export async function manageCenterFolder(body:any,user:Client,admin:Client,actor:string){
 const folder=await requireCenterFolder(String(body.id || ""),user,admin,actor,true);
 if(body.action==="center-folder-rename"){
  const name=cleanFolderName(body.name);
  const q=admin.from("file_center_folders").select("id").eq("owner_user_id",folder.owner_user_id).eq("name",name).neq("id",folder.id);
  const previous=await (folder.parent_id?q.eq("parent_id",folder.parent_id):q.is("parent_id",null)).maybeSingle();
  if(previous.error)throw previous.error;if(previous.data)throw new Error("Já existe uma pasta com esse nome.");
  await renameDriveFile(folder.drive_folder_id,name);
  const result=await admin.from("file_center_folders").update({name}).eq("id",folder.id).select("*").single();
  if(result.error){await renameDriveFile(folder.drive_folder_id,folder.name).catch(console.error);throw result.error;}return result.data;
 }
 // Refuse recursive removal: unrelated files placed directly in Drive are protected too.
 const children=await listDriveChildren(folder.drive_folder_id);
 if(children.files?.length || children.nextPageToken)throw new Error("A pasta contém arquivos ou subpastas. Mova ou exclua o conteúdo primeiro.");
 const active=await admin.from("drive_files").select("id").eq("central_folder_id",folder.id).neq("status","trashed").limit(1);
 if(active.error)throw active.error;if(active.data?.length)throw new Error("A pasta ainda possui arquivos cadastrados.");
 const nested=await admin.from("file_center_folders").select("id").eq("parent_id",folder.id).limit(1);
 if(nested.error)throw nested.error;if(nested.data?.length)throw new Error("A pasta ainda possui subpastas.");
 await trashDriveFile(folder.drive_folder_id);
 const unlinked=await admin.from("drive_files").update({central_folder_id:null}).eq("central_folder_id",folder.id).eq("status","trashed");
 if(unlinked.error)throw unlinked.error;
 const deleted=await admin.from("file_center_folders").delete().eq("id",folder.id).select("id").maybeSingle();
 if(deleted.error || !deleted.data)throw deleted.error || new Error("Exclusão da pasta não confirmada.");
 return {id:folder.id};
}
