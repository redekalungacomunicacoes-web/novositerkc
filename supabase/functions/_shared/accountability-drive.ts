import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureDriveFolder, getDriveFolder, findDriveFolder, getDriveFileMetadata, copyDriveOfficeTemplate, findAccountabilityExport, uploadDriveFile, assertPrivateDriveFile } from "./google-drive.ts";
import { withCenterLease } from "./file-center.ts";

export async function getFinanceDriveChild(root: string, name: "MODELOS_OFICIAIS" | "PRESTACOES_DE_CONTAS") {
  const rootFolder = await getDriveFolder(root);
  if (rootFolder.name !== "RKC - FINANCEIRO PRIVADO" || rootFolder.driveId) {
    throw new Error("Raiz privada do financeiro inválida.");
  }
  await assertPrivateDriveFile(root, true);
  const child = await findDriveFolder(root, name);
  if (!child) throw new Error(`Pasta financeira ${name} indisponível.`);
  const verified = await getDriveFolder(child.id);
  if (!verified.parents?.includes(root)) throw new Error("Pasta fora da raiz financeira privada.");
  await assertPrivateDriveFile(verified.id, true);
  return verified;
}

export async function verifyAccountabilityFolder(folderId: string, root: string, privateParent?: string) {
  const folder = await getDriveFolder(folderId);
  const parent = privateParent ?? (await getFinanceDriveChild(root, "PRESTACOES_DE_CONTAS")).id;
  if (!folder.parents?.includes(parent)) {
    const legacyRoot = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
    const legacyFinance = legacyRoot && await findDriveFolder(legacyRoot, "FINANCEIRO");
    const legacyParent = legacyFinance && await findDriveFolder(legacyFinance.id, "PRESTACOES_DE_CONTAS");
    if (!legacyParent || !folder.parents?.includes(legacyParent.id)) {
      throw new Error("Pasta da prestação fora do Drive financeiro.");
    }
    const verified = await getDriveFolder(legacyParent.id, true);
    if (!verified.parents?.includes(legacyFinance.id)) throw new Error("Pasta financeira anterior inválida.");
  }
  await assertPrivateDriveFile(folder.id, true);
  return folder;
}

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
    const parent = await getFinanceDriveChild(root, "PRESTACOES_DE_CONTAS");
    if (!row.drive_folder_id && !parent.capabilities?.canAddChildren) {
      throw new Error("A integração não pode criar pastas no Drive financeiro.");
    }
    let name = row.drive_folder_name;
    if (!name) {
      name = (String(row.title).replace(/[\\/\r\n]/g, "-").trim().slice(0,75) || "Prestação") + " - " + reportId;
      const saved = await admin.from("finance_accountability_reports").update({drive_folder_name:name}).eq("id",reportId).select("id").single();
      if (saved.error) throw saved.error;
    }
    const folderId = row.drive_folder_id || (await ensureDriveFolder(parent.id, name)).id;
    const folder = await verifyAccountabilityFolder(folderId, root, parent.id);
    if (!folder.capabilities?.canAddChildren) throw new Error("A integração não pode criar documentos na prestação.");
    for (const child of ["DOCUMENTOS_OFICIAIS", "COMPROVANTES", "EVIDENCIAS", "EXPORTACOES"]) {
      const directory = await ensureDriveFolder(folder.id, child);
      await assertPrivateDriveFile(directory.id, true);
    }
    if (row.drive_folder_id !== folder.id) {
      const saved = await admin.from("finance_accountability_reports").update({drive_folder_id:folder.id}).eq("id",reportId).select("id").single();
      if (saved.error) throw saved.error;
    }
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
    const models = await getFinanceDriveChild(root, "MODELOS_OFICIAIS");
    const destination = await ensureDriveFolder(folderId,"DOCUMENTOS_OFICIAIS");
    await assertPrivateDriveFile(destination.id, true);
    const specs = [
      {type:"financial_spreadsheet",id:template.data.spreadsheet_template_path,name:"Planilha Financeira.xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
      {type:"narrative_document",id:template.data.narrative_template_path,name:"Formulário Narrativo.docx",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    ];
    // Validate both sources before creating either copy. Paths contain Drive IDs, not URLs.
    for (const spec of specs) {
      if (!spec.id || !/^[A-Za-z0-9_-]{10,}$/.test(spec.id)) throw new Error("Vincule os dois modelos oficiais antes de continuar.");
      await assertPrivateDriveFile(spec.id, true);
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

export async function uploadAccountabilityEvidence(form: FormData, root: string, user: SupabaseClient, admin: SupabaseClient, actor: string) {
  const reportId = String(form.get("report_id") || "");
  const uploadId = String(form.get("upload_id") || "");
  const category = form.get("category");
  const file = form.get("file");
  const allowedMime = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024 || !allowedMime.includes(file.type)) {
    throw new Error("Envie um PDF, JPEG, PNG ou WebP de até 15 MB.");
  }
  if (!/^[0-9a-f-]{36}$/i.test(uploadId) || (category !== "comprovante" && category !== "evidencia")) {
    throw new Error("Identificação do anexo inválida.");
  }
  const folderId = await prepareAccountabilityFolder(reportId, root, user, admin);
  return await withCenterLease("accountability:" + root, admin, async () => {
    const report = await user.from("finance_accountability_reports").select("status").eq("id", reportId).single();
    if (report.error || report.data?.status !== "draft") throw new Error("Anexos só podem ser enviados durante o preenchimento.");
    const directory = await ensureDriveFolder(folderId, category === "comprovante" ? "COMPROVANTES" : "EVIDENCIAS");
    const verified = await getDriveFolder(directory.id);
    await assertPrivateDriveFile(directory.id, true);
    if (!verified.parents?.includes(folderId) || !verified.capabilities?.canAddChildren) throw new Error("Destino do anexo inválido.");
    const key = reportId + ":" + uploadId;
    const previous = await findAccountabilityExport(directory.id, key);
    const safeName = file.name.replace(/[\\/\r\n]/g, "-").slice(0, 180);
    const stored = previous ?? await uploadDriveFile(new File([file], safeName, {type: file.type}), directory.id, {rkcAccountabilityExport: key});
    await assertPrivateDriveFile(stored.id, true);
    const linked = await admin.from("finance_accountability_documents").select("id")
      .eq("report_id", reportId).eq("storage_path", stored.id).maybeSingle();
    if (linked.error) throw linked.error;
    if (!linked.data) {
      const registered = await admin.from("finance_accountability_documents").insert({
        report_id: reportId, document_type: "supporting_attachment", file_name: stored.name ?? safeName,
        mime_type: stored.mimeType ?? file.type, storage_path: stored.id, created_by: actor,
        metadata: { provider: "google_drive", category, upload_id: uploadId },
      });
      if (registered.error) throw registered.error;
    }
    return {id: stored.id, name: stored.name ?? safeName};
  });
}
