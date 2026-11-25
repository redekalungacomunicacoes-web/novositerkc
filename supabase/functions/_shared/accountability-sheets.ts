import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertPrivateDriveFile, copyDriveOfficeTemplate, downloadDriveFile, ensureDriveFolder, findAccountabilityCopy, findDriveFolder,
  getDriveFileMetadata, googleSheetsFetch, uploadDriveFile,
} from "./google-drive.ts";
import { fillFajWorkbook } from "./faj-office-export.ts";
import { getFinanceDriveChild, prepareAccountabilityFolder, verifyAccountabilityFolder } from "./accountability-drive.ts";
import { withCenterLease } from "./file-center.ts";
import { reconcileCells, type Cells, type CellValue } from "./accountability-sheet-reconcile.ts";
import {
  a1, applyFajCells, fajEditableCells, fajEditableKeys, fajFormulaCorrections,
  fajTabs, normalizeFajCell, readFajCells, type FajReportData,
} from "./faj-sheet-mapping.ts";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const SHEET_NAME = "Planilha Financeira FAJ · Google Sheets";
const PROTECTION = "RKC · campos oficiais e fórmulas";
const REPORT_FIELDS = "id,template_id,status,financial_data,narrative_data,drive_folder_id";
const STATE = "finance_accountability_sheet_sync";
type Conflict = ReturnType<typeof reconcileCells>["conflicts"][number];
type State = {
  spreadsheet_id: string;
  status: "pending" | "synced" | "conflict" | "error";
  baseline: Cells;
  conflicts: Conflict[];
  conflict_token: string | null;
  error: string | null;
  last_synced_at: string | null;
};
type Report = FajReportData & { id: string; status: string; template_id: string; drive_folder_id: string | null };
type Entered = { stringValue?: string; numberValue?: number; boolValue?: boolean; formulaValue?: string };
type GridCell = { userEnteredValue?: Entered; dataValidation?: unknown };
type GridRange = {
  sheetId: number;
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
};
type Sheet = {
  properties: { sheetId: number; title: string; hidden?: boolean };
  protectedRanges?: { description?: string; warningOnly?: boolean; range: GridRange; unprotectedRanges?: GridRange[] }[];
  data?: { startRow?: number; startColumn?: number; rowData?: { values?: GridCell[] }[] }[];
};
const sheetBounds = [ "A1:B7", "A1:G17", "A1:I30", "A1:I26", "A1:G26", "A1:J11"];
const expectedNumberOfFormulas = 86;
// Sheets returns localized separators for the FAJ template imported with pt_BR.
const localizedFormula = (formula: string) => formula.replace(/,/g, ";");
const matchesFormula = (value: string | undefined, formula: string) =>
  value === formula || value === localizedFormula(formula);
const cellOf = (tab: string, row: number, column: number) => ({ tab, row, column });
const linkedOrganization = cellOf(fajTabs[4], 3, 2);
const sameCells = (left: Cells, right: Cells) => fajEditableKeys.every(key => left[key] === right[key]);
const own = (values: Cells, key: string) => Object.hasOwn(values, key);

async function authorize(reportId: string, user: SupabaseClient): Promise<Report> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) throw new Error("Prestação inválida.");
  const role = await user.rpc("can_manage_finance_accountability");
  if (role.error || role.data !== true) throw new Error("Sem permissão financeira.");
  const { data, error } = await user.from("finance_accountability_reports").select(REPORT_FIELDS).eq("id", reportId).maybeSingle();
  if (error || !data) throw new Error("Prestação indisponível.");
  return data;
}

async function stateOf(reportId: string, admin: SupabaseClient): Promise<State | null> {
  const { data, error } = await admin.from(STATE)
    .select("spreadsheet_id,status,baseline,conflicts,conflict_token,error,last_synced_at").eq("report_id", reportId).maybeSingle();
  if (error) throw error;
  return data;
}

function publicStatus(state: State | null, editable: boolean) {
  return {
    spreadsheet_id: state?.spreadsheet_id ?? null,
    status: !editable ? "locked" : state?.status ?? "unlinked",
    conflicts: state?.conflicts ?? [],
    conflict_count: state?.conflicts.length ?? 0,
    conflict_token: state?.conflict_token ?? null,
    error: state?.error ?? null,
    last_synced_at: state?.last_synced_at ?? null,
  };
}

export async function getAccountabilitySheetStatus(reportId: string, user: SupabaseClient, admin: SupabaseClient) {
  const report = await authorize(reportId, user);
  return publicStatus(await stateOf(reportId, admin), report.status === "draft");
}

async function sheetsResponse(path: string, init?: RequestInit) {
  const response = await googleSheetsFetch(path, init);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("A integração do Google não tem acesso à API Sheets ou à planilha.");
    if (response.status === 429) throw new Error("Limite do Google Sheets atingido. Aguarde e tente novamente.");
    throw new Error(`Google Sheets indisponível (HTTP ${response.status}).`);
  }
  return await response.json();
}

async function assertSheetManifest(id: string) {
  const params = new URLSearchParams({ fields: "sheets(properties(title,hidden))" });
  const result: { sheets?: Sheet[] } = await sheetsResponse(`${encodeURIComponent(id)}?${params}`);
  const titles = new Set(result.sheets?.map(sheet => sheet.properties.title));
  titles.delete("0_APRESENTACAO"); // Previously provisioned copies may retain this extra tab.
  if (titles.size !== fajTabs.length || fajTabs.some(tab => !titles.has(tab)) ||
    !result.sheets?.find(sheet => sheet.properties.title === "LISTAS")?.properties.hidden) {
    throw new Error("A planilha não possui as seis abas oficiais com LISTAS oculta.");
  }
}

async function snapshot(id: string) {
  const params = new URLSearchParams({
    fields: "properties(locale),sheets(properties(sheetId,title,hidden),protectedRanges(description,warningOnly,range,unprotectedRanges),data(startRow,startColumn,rowData(values(userEnteredValue,dataValidation))))",
  });
  fajTabs.forEach((tab, index) => params.append("ranges", `'${tab}'!${sheetBounds[index]}`));
  // A missing tab makes the requested A1 ranges invalid. An independent metadata query
  // is unnecessary for current report reads because the template check captures all tabs.
  const result: { properties?: { locale?: string }; sheets?: Sheet[] } = await sheetsResponse(`${encodeURIComponent(id)}?${params}`);
  const tabs = new Map(result.sheets?.map(sheet => [sheet.properties.title, sheet]));
  const entries = new Map<string, GridCell>();
  for (const grid of tabs.values()) {
    const tab = grid.properties.title;
    for (const block of grid.data ?? []) {
      (block.rowData ?? []).forEach((row, rowOffset) => row.values?.forEach((cell, columnOffset) => {
        entries.set(a1(cellOf(tab, (block.startRow ?? 0) + rowOffset + 1, (block.startColumn ?? 0) + columnOffset + 1)), cell);
      }));
    }
  }
  const cells: Cells = Object.create(null);
  for (const cell of fajEditableCells) {
    const key = a1(cell);
    const entered = entries.get(key)?.userEnteredValue;
    if (entered?.formulaValue !== undefined) throw new Error(`Remova a fórmula do campo editável ${key} antes de sincronizar.`);
    cells[key] = normalizeFajCell(cell, entered?.stringValue ?? entered?.numberValue ?? entered?.boolValue);
  }
  return { tabs, entries, cells, locale: result.properties?.locale };
}

function assertLayout(sheet: Awaited<ReturnType<typeof snapshot>>, initialized: boolean) {
  if (sheet.tabs.size !== fajTabs.length || fajTabs.some(tab => !sheet.tabs.has(tab)) || sheet.tabs.get("LISTAS")?.properties.hidden !== true) {
    throw new Error("A planilha não possui as seis abas oficiais com LISTAS oculta.");
  }
  if ([...sheet.entries.values()].filter(cell => cell.userEnteredValue?.formulaValue !== undefined).length !== expectedNumberOfFormulas) {
    throw new Error("As 86 fórmulas oficiais precisam estar presentes na planilha.");
  }
  const validations = [
    [fajTabs[2], 3, 18, [5, 6, 7]],
    [fajTabs[3], 2, 17, [3, 4, 5, 7]],
    [fajTabs[4], 8, 17, [3, 4]],
  ] as const;
  for (const [tab, first, last, columns] of validations) {
    for (let row = first; row <= last; row++) {
      for (const column of columns) {
        const key = a1(cellOf(tab, row, column));
        if (!sheet.entries.get(key)?.dataValidation) throw new Error(`Validação oficial ausente em ${key}.`);
      }
    }
  }
  if (initialized) {
    for (const correction of fajFormulaCorrections) {
      const value = sheet.entries.get(a1(correction))?.userEnteredValue?.formulaValue;
      if (!matchesFormula(value, correction.formula)) throw new Error(`Fórmula oficial divergente em ${a1(correction)}.`);
    }
    for (const tab of fajTabs) {
      const grid = sheet.tabs.get(tab)!;
      const protection = grid.protectedRanges?.find(item => item.description === PROTECTION && !item.warningOnly);
      const allowed = fajEditableCells.filter(cell => cell.tab === tab);
      if (!protection || protection.range.sheetId !== grid.properties.sheetId
        || protection.range.startRowIndex || protection.range.endRowIndex
        || protection.range.startColumnIndex || protection.range.endColumnIndex
        || (protection.unprotectedRanges?.length ?? 0) !== allowed.length
        || allowed.some(cell => !protection.unprotectedRanges?.some(range =>
          range.sheetId === grid.properties.sheetId && range.startRowIndex === cell.row - 1 && range.endRowIndex === cell.row &&
          range.startColumnIndex === cell.column - 1 && range.endColumnIndex === cell.column))) {
        throw new Error(`A proteção dos campos oficiais foi alterada em ${tab}.`);
      }
    }
  }
}

function gridRange(sheetId: number, row: number, column: number): GridRange {
  return { sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: column - 1, endColumnIndex: column };
}

function updateCell(sheet: Awaited<ReturnType<typeof snapshot>>, tab: string, row: number, column: number, value: Entered | null) {
  return {
    updateCells: {
      start: { sheetId: sheet.tabs.get(tab)!.properties.sheetId, rowIndex: row - 1, columnIndex: column - 1 },
      rows: [{ values: [value === null ? {} : { userEnteredValue: value }] }],
      fields: "userEnteredValue",
    },
  };
}

async function writeBatch(id: string, requests: unknown[]) {
  if (!requests.length) return;
  await sheetsResponse(`${encodeURIComponent(id)}:batchUpdate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests }),
  });
}

async function protectAndCorrect(id: string, sheet: Awaited<ReturnType<typeof snapshot>>) {
  const requests: unknown[] = fajFormulaCorrections
    .filter(correction => !matchesFormula(sheet.entries.get(a1(correction))?.userEnteredValue?.formulaValue, correction.formula))
    .map(({ tab, row, column, formula }) => updateCell(sheet, tab, row, column, {
      formulaValue: sheet.locale === "pt_BR" ? localizedFormula(formula) : formula,
    }));
  for (const tab of fajTabs) {
    const { properties: { sheetId }, protectedRanges } = sheet.tabs.get(tab)!;
    if (protectedRanges?.some(range => range.description === PROTECTION)) continue;
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId }, description: PROTECTION, warningOnly: false,
          unprotectedRanges: fajEditableCells.filter(cell => cell.tab === tab).map(cell => gridRange(sheetId, cell.row, cell.column)),
        },
      },
    });
  }
  if (requests.length) await writeBatch(id, requests);
}

async function validateBoundFile(id: string, reportFolderId: string, root: string) {
  const [folder, file] = await Promise.all([
    findDriveFolder(reportFolderId, "DOCUMENTOS_OFICIAIS"),
    getDriveFileMetadata(id),
    verifyAccountabilityFolder(reportFolderId, root),
  ]);
  if (!folder || file.trashed || file.mimeType !== SHEET_MIME || !file.parents?.includes(folder.id)) {
    throw new Error("A planilha foi movida ou não está mais disponível na pasta institucional.");
  }
  await Promise.all([assertPrivateDriveFile(folder.id, true), assertPrivateDriveFile(id, true)]);
}

async function approveSource(id: unknown, mime: string, modelsId: string) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{10,}$/.test(id)) {
    throw new Error("Vincule o modelo financeiro em branco na versão FAJ II Ciclo.");
  }
  const [source] = await Promise.all([getDriveFileMetadata(id), assertPrivateDriveFile(id, true)]);
  if (source.trashed || source.mimeType !== mime || !source.parents?.includes(modelsId)) {
    throw new Error("O modelo financeiro deve estar na pasta restrita de modelos oficiais e no formato esperado.");
  }
  return { id, size: Number(source.size) };
}

async function convertWorkbook(source: { id: string; size: number }, approvedHash: unknown, folderId: string, key: string) {
  if (typeof approvedHash !== "string" || !/^[a-f\d]{64}$/.test(approvedHash)) {
    throw new Error("Vincule um modelo Google Sheets em branco ou um XLSX revisado com SHA-256 cadastrado.");
  }
  if (!Number.isFinite(source.size) || source.size > 5 * 1024 * 1024) throw new Error("O modelo XLSX excede 5 MB ou está indisponível.");
  const existing = await findAccountabilityCopy(folderId, key);
  if (existing) return existing;
  const response = await downloadDriveFile(source.id);
  if (!response.ok) throw new Error("Não foi possível ler o XLSX oficial.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (await sha256(bytes) !== approvedHash) throw new Error("O modelo XLSX mudou desde a revisão.");
  const sanitized = await fillFajWorkbook(bytes, { narrative_data: {}, financial_data: {} });
  const file = new File([Uint8Array.from(sanitized)], SHEET_NAME, { type: XLSX_MIME });
  return await uploadDriveFile(file, folderId, { rkcAccountabilityCopy: key }, SHEET_MIME);
}

async function provision(report: Report, root: string, reportFolderId: string, admin: SupabaseClient) {
  const { data: template, error } = await admin.from("finance_reporting_templates")
    .select("slug,version,structure,spreadsheet_template_path").eq("id", report.template_id).single();
  if (error || template?.slug !== "faj-ii-ciclo" || template.version !== 1) {
    throw new Error("A sincronização está disponível para o modelo FAJ II Ciclo v1.");
  }
  const models = await getFinanceDriveChild(root, "MODELOS_OFICIAIS");
  const destination = await ensureDriveFolder(reportFolderId, "DOCUMENTOS_OFICIAIS");
  await assertPrivateDriveFile(destination.id, true);
  const key = report.id + ":sheets:v1";
  const sourceId = template.structure?.google_sheets_template_id;
  let copy: { id: string; mimeType: string; parents?: string[] };
  if (sourceId) {
    const source = await approveSource(sourceId, SHEET_MIME, models.id);
    await assertSheetManifest(source.id);
    const sourceSnapshot = await snapshot(source.id);
    assertLayout(sourceSnapshot, false);
    assertBlank(sourceSnapshot);
    copy = await copyDriveOfficeTemplate(source.id, destination.id, SHEET_NAME, key, SHEET_MIME);
    if (copy.id === source.id) throw new Error("O modelo original não pode ser sincronizado.");
  } else {
    const source = await approveSource(template.spreadsheet_template_path, XLSX_MIME, models.id);
    copy = await convertWorkbook(source, template.structure?.faj_exports?.xlsx_clean_template_sha256, destination.id, key);
  }
  await validateBoundFile(copy.id, reportFolderId, root);
  await assertSheetManifest(copy.id);
  const copiedSnapshot = await snapshot(copy.id);
  assertLayout(copiedSnapshot, false);
  assertBlank(copiedSnapshot);
  await protectAndCorrect(copy.id, copiedSnapshot);
  assertLayout(await snapshot(copy.id), true);
  const { error: insertError } = await admin.from(STATE).insert({
    report_id: report.id, spreadsheet_id: copy.id, baseline: copiedSnapshot.cells,
  });
  if (insertError) throw insertError;
  return (await stateOf(report.id, admin))!;
}

function assertBlank(sheet: Awaited<ReturnType<typeof snapshot>>) {
  if (Object.values(sheet.cells).some(value => value !== null)
    || Object.keys(sheet.entries.get(a1(linkedOrganization))?.userEnteredValue ?? {}).length) {
    throw new Error("Use um modelo oficial em branco, sem dados de outras prestações.");
  }
}

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function digestConflicts(conflicts: Conflict[]) {
  return await sha256(new TextEncoder().encode(JSON.stringify(conflicts)));
}

const entered = (value: CellValue): Entered | null => value === null ? null
  : typeof value === "number" ? { numberValue: value }
  : typeof value === "boolean" ? { boolValue: value }
  : { stringValue: value };

function validateFinancial(data: unknown) {
  if (!data || typeof data !== "object") return;
  const { team, budgetExcludingTeam } = data as {
    team?: { monthly?: number; charges?: number; months?: number; faj?: number }[];
    budgetExcludingTeam?: { total?: number; faj?: number }[];
  };
  const sum = (a: number, b: number) => Math.round(a * 100) + Math.round(b * 100);
  const teamInvalid = Array.isArray(team) && team.some(row => row?.faj != null &&
    (row.monthly == null || row.months == null || Math.round(row.faj * 100) > sum(row.monthly, row.charges ?? 0) * row.months));
  const budgetInvalid = Array.isArray(budgetExcludingTeam) && budgetExcludingTeam.some(row => row?.faj != null &&
    (row.total == null || row.faj > row.total));
  if (teamInvalid || budgetInvalid) throw new Error("O valor financiado pelo FAJ deve ter custo previsto e não pode excedê-lo.");
}

export async function syncAccountabilitySheet(
  reportId: string,
  root: string,
  user: SupabaseClient,
  admin: SupabaseClient,
  actor: string,
  options: { resolution?: "panel" | "sheet"; conflictToken?: string } = {},
) {
  let report = await authorize(reportId, user);
  if (report.status !== "draft") throw new Error("A sincronização de edição está disponível apenas para rascunhos.");
  // Reuse the module's Drive destination checks and idempotent folder setup.
  const current = await stateOf(reportId, admin);
  const folderId = current && report.drive_folder_id
    ? report.drive_folder_id : await prepareAccountabilityFolder(reportId, root, user, admin);
  return await withCenterLease("accountability-sheet:" + reportId, admin, async () => {
    report = await authorize(reportId, user);
    if (report.status !== "draft" || report.drive_folder_id !== folderId) throw new Error("A prestação foi alterada. Atualize antes de sincronizar.");
    let state = await stateOf(reportId, admin);
    try {
      state ??= await provision(report, root, folderId, admin);
      const id = state.spreadsheet_id;
      await validateBoundFile(id, folderId, root);
      const sheet = await snapshot(id);
      assertLayout(sheet, true);
      const panel = readFajCells(report);
      const { toPanel, toSheet, conflicts, missing } = reconcileCells(state.baseline, panel, sheet.cells, fajEditableKeys);
      if (missing.length) throw new Error("O estado da última sincronização está incompleto; revisão necessária.");
      const token = conflicts.length ? await digestConflicts(conflicts) : null;
      if (conflicts.length && (!options.resolution || options.conflictToken !== token || state.conflict_token !== token)) {
        const saved = await admin.from(STATE).update({ status: "conflict", conflicts, conflict_token: token, error: null }).eq("report_id", reportId);
        if (saved.error) throw saved.error;
        return { sync: publicStatus({ ...state, status: "conflict", conflicts, conflict_token: token, error: null }, true), pulled: false };
      }
      if (!conflicts.length && options.resolution) throw new Error("O conflito mudou desde a última consulta. Atualize antes de resolver.");
      for (const conflict of conflicts) {
        if (options.resolution === "panel") toSheet[conflict.key] = conflict.panel;
        else toPanel[conflict.key] = conflict.sheet;
      }
      const nextReport = applyFajCells(report, toPanel);
      if (Object.keys(toPanel).length || Object.keys(toSheet).length) validateFinancial(nextReport.financial_data);
      const nextCells = { ...panel, ...toPanel };
      const requests = fajEditableCells.filter(cell => own(toSheet, a1(cell))).map(cell =>
        updateCell(sheet, cell.tab, cell.row, cell.column, entered(toSheet[a1(cell)])));
      const organization = nextCells[a1(cellOf(fajTabs[0], 3, 2))];
      const linkedValue = sheet.entries.get(a1(linkedOrganization))?.userEnteredValue;
      if (linkedValue?.formulaValue) throw new Error("O campo Grantee contém uma fórmula inesperada.");
      if ((linkedValue?.stringValue ?? linkedValue?.numberValue ?? null) !== organization) {
        requests.push(updateCell(sheet, linkedOrganization.tab, linkedOrganization.row, linkedOrganization.column, entered(organization)));
      }
      if (requests.length) {
        const latestReport = await authorize(reportId, user);
        if (latestReport.status !== "draft" || !sameCells(panel, readFajCells(latestReport))) {
          throw new Error("O painel mudou durante a sincronização. Tente novamente.");
        }
        const latestSheet = await snapshot(id);
        if (!sameCells(sheet.cells, latestSheet.cells)) throw new Error("O Google Sheets mudou durante a sincronização. Tente novamente.");
        assertLayout(latestSheet, true);
        if (fajTabs.some(tab => latestSheet.tabs.get(tab)?.properties.sheetId !== sheet.tabs.get(tab)?.properties.sheetId)) {
          throw new Error("A estrutura do Google Sheets mudou durante a sincronização.");
        }
        await writeBatch(id, requests);
      }
      if (!requests.length && !Object.keys(toPanel).length && state.status === "synced" && sameCells(state.baseline, panel)) {
        return { sync: publicStatus(state, true), pulled: false };
      }
      const confirmed = await snapshot(id);
      assertLayout(confirmed, true);
      if (!sameCells(confirmed.cells, nextCells)) throw new Error("Não foi possível confirmar os dados no Google Sheets. Tente novamente.");
      const changes = Object.fromEntries(fajEditableKeys.filter(key => own(toPanel, key) || own(toSheet, key)).map(key =>
        [key, { from: own(toPanel, key) ? panel[key] : sheet.cells[key], to: nextCells[key], direction: own(toPanel, key) ? "panel" : "sheet" }]));
      const committed = await admin.rpc("complete_finance_accountability_sheet_sync", {
        p_report_id: reportId, p_spreadsheet_id: id, p_actor: actor,
        p_expected_narrative: report.narrative_data, p_expected_financial: report.financial_data,
        p_next_narrative: nextReport.narrative_data, p_next_financial: nextReport.financial_data,
        p_baseline: nextCells, p_changes: changes,
      });
      if (committed.error || committed.data !== true) throw new Error("Os dados no painel mudaram durante a sincronização. Tente novamente.");
      return { sync: publicStatus(await stateOf(reportId, admin), true), pulled: Object.keys(toPanel).length > 0 };
    } catch (error) {
      if (!state) throw error;
      const detail = error instanceof Error ? error.message : "Falha na sincronização com Google Sheets.";
      const saved = await admin.from(STATE).update({ status: "error", error: detail }).eq("report_id", reportId);
      if (saved.error) throw error;
      return { sync: publicStatus({ ...state, status: "error", error: detail }, true), pulled: false };
    }
  });
}
