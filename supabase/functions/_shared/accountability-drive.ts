import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureDriveFolder, getDriveFolder } from "./google-drive.ts";
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
