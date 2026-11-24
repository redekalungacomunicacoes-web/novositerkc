import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureDriveFolder, getDriveFolder, findDriveFolder, getDriveFileMetadata, copyDriveOfficeTemplate } from "./google-drive.ts";
import { withCenterLease } from "./file-center.ts";

export async function prepareAccountabilityFolder(reportId: string, root: string, user: SupabaseClient, admin: SupabaseClient) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) throw new Error("Prestação inválida.");
  const role = await user.rpc("can_manage_finance_accountability");
  if (role.error || role.data !== true) throw new Error("Sem permissão financeira.");
  const access = await user.from("finance_accountability_reports").select("id").eq("id", reportId).single();
  if (access.error || !access.data) throw new Error("Prestação indisponível.");
  return await withCenterLease("accountability:" + root, admin, async () => {
    const result = await admin.from("finance_accountability_reports").select("id,title,drive_folder_id,drive_folder_name").eq("id", reportId).single();
    if (result.error || !result.data) throw new Error("Prestação indisponível.");
    const row = result.data;
    const rootFolder = await getDriveFolder(root);
    if (rootFolder.name !== "RKC - SISTEMA DO SITE") throw new Error("Raiz institucional inválida.");
    const finance = await ensureDriveFolder(root, "FINANCEIRO");
    const parent = await ensureDriveFolder(finance.id, "PRESTACOES_DE_CONTAS");
    // Never send financial files before the destination is confirmed private.
    const verified = await getDriveFolder(parent.id, true);
    if (!verified.parents?.includes(finance.id) || !verified.capabilities?.canAddChildren) throw new Error("Destino financeiro inválido.");
    let name = row.drive_folder_name;
    if (!name) {
      name = (String(row.title).replace(/[\\/\r\n]/g, "-").trim().slice(0,75) || "Prestação") + " - " + reportId;
      const saved = await admin.from("finance_accountability_reports").update({drive_folder_name:name}).eq("id",reportId).select("id").single();
      if (saved.error) throw saved.error;
    }
    const folder = row.drive_folder_id ? await getDriveFolder(row.drive_folder_id) : await ensureDriveFolder(parent.id,name);
    if (!folder.parents?.includes(parent.id)) throw new Error("Pasta fora do destino financeiro.");
    for (const child of ["DOCUMENTOS_OFICIAIS","COMPROVANTES","EVIDENCIAS"]) await ensureDriveFolder(folder.id,child);
    const saved = await admin.from("finance_accountability_reports").update({drive_folder_id:folder.id}).eq("id",reportId).select("id").single();
    if (saved.error) throw saved.error;
    return folder.id as string;
  });
}

export async function prepareAccountabilityDocuments(reportId: string, root: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  const folderId = await prepareAccountabilityFolder(reportId,root,user,admin);
  return await withCenterLease("accountability:" + root, admin, async () => {
    const report = await admin.from("finance_accountability_reports").select("id,template_id,status").eq("id",reportId).single();
    if (report.error || !report.data || report.data.status !== "draft") throw new Error("Somente rascunhos podem receber modelos.");
    const template = await admin.from("finance_reporting_templates").select("id,version,spreadsheet_template_path,narrative_template_path").eq("id",report.data.template_id).single();
    if (template.error || !template.data) throw new Error("Modelo indisponível.");
    const finance = await findDriveFolder(root,"FINANCEIRO");
    if (!finance) throw new Error("Financeiro indisponível.");
    const models = await findDriveFolder(finance.id,"MODELOS_OFICIAIS");
    if (!models) throw new Error("Cadastre os modelos oficiais no Drive financeiro.");
    await getDriveFolder(models.id,true);
    const destination = await ensureDriveFolder(folderId,"DOCUMENTOS_OFICIAIS");
    const specs = [
      {type:"financial_spreadsheet",id:template.data.spreadsheet_template_path,name:"Planilha Financeira.xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
      {type:"narrative_document",id:template.data.narrative_template_path,name:"Formulário Narrativo.docx",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    ];
    // Validate both sources before creating either copy. Paths contain Drive IDs, not URLs.
    for (const spec of specs) {
      if (!spec.id || !/^[A-Za-z0-9_-]{10,}$/.test(spec.id)) throw new Error("Vincule os dois modelos oficiais antes de continuar.");
      const source = await getDriveFileMetadata(spec.id);
      if (source.trashed || source.mimeType !== spec.mime || !source.parents?.includes(models.id)) throw new Error("Modelo fora da pasta oficial ou formato incompatível.");
    }
    const documents = [];
    for (const spec of specs) {
      const key = reportId + ":" + spec.type + ":" + template.data.version;
      const copied = await copyDriveOfficeTemplate(spec.id,destination.id,spec.name,key,spec.mime);
      const previous = await admin.from("finance_accountability_documents").select("id").eq("report_id",reportId).eq("storage_path",copied.id).maybeSingle();
      if (previous.error) throw previous.error;
      if (!previous.data) {
        const saved = await admin.from("finance_accountability_documents").insert({report_id:reportId,document_type:spec.type,template_version:template.data.version,file_name:copied.name,mime_type:spec.mime,storage_path:copied.id,created_by:actor,metadata:{provider:"google_drive",stage:"template_copy",source_drive_id:spec.id}});
        if (saved.error) throw saved.error;
      }
      documents.push({id:copied.id,name:copied.name});
    }
    return documents;
  });
}
