import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { prepareAccountabilityFolder } from './accountability-drive.ts';
import { withCenterLease } from './file-center.ts';
import { assertPrivateDriveFile, downloadDriveFile, ensureDriveFolder, findAccountabilityExport, findDriveFolder, getDriveFileMetadata, getDriveFolder, uploadDriveFile } from './google-drive.ts';
import { fillFajNarrative, fillFajWorkbook, object } from './faj-office-export.ts';
import { renderFajConsolidatedPdf } from './faj-pdf-export.ts';

const FORMATS = {
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'Planilha Financeira', type: 'financial_spreadsheet' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'Formulário Narrativo', type: 'narrative_document' },
  pdf: { mime: 'application/pdf', name: 'Relatório Consolidado', type: 'consolidated_report' },
} as const;
type Format = keyof typeof FORMATS;
const generatorVersion = 'faj-ii-1';

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readSource(id: unknown, root: string, mime: string) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error('O modelo oficial da versão ainda não está vinculado.');
  const finance = await findDriveFolder(root, 'FINANCEIRO');
  if (!finance) throw new Error('Pasta FINANCEIRO indisponível.');
  const models = await findDriveFolder(finance.id, 'MODELOS_OFICIAIS');
  if (!models) throw new Error('Pasta de modelos oficiais indisponível.');
  await getDriveFolder(models.id, true);
  const metadata = await getDriveFileMetadata(id);
  if (metadata.trashed || metadata.mimeType !== mime || !metadata.parents?.includes(models.id)) {
    throw new Error('O modelo oficial está fora da pasta de modelos ou não tem o formato esperado.');
  }
  await assertPrivateDriveFile(id, true);
  if (Number(metadata.size) > 5 * 1024 * 1024) throw new Error('O modelo oficial excede 5 MB.');
  const response = await downloadDriveFile(id);
  if (!response.ok) throw new Error('Não foi possível ler o modelo oficial.');
  return new Uint8Array(await response.arrayBuffer());
}

export async function generateAccountabilityDocument(
  reportId: string,
  requestedFormat: string,
  root: string,
  user: SupabaseClient,
  admin: SupabaseClient,
  actor: string,
) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(reportId)) throw new Error('Prestação inválida.');
  if (!Object.hasOwn(FORMATS, requestedFormat)) throw new Error('Formato de exportação inválido.');
  const format = requestedFormat as Format;
  const spec = FORMATS[format];
  // Access is checked using the caller's RLS before privileged Drive operations.
  const [reportResult, role] = await Promise.all([
    user.from('finance_accountability_reports')
      .select('id,title,template_id,status,period_start,period_end,financial_data,narrative_data')
      .eq('id', reportId).single(),
    user.rpc('can_manage_finance_accountability'),
  ]);
  if (reportResult.error || !reportResult.data || role.error || role.data !== true) throw new Error('Prestação indisponível ou sem permissão.');
  const report = reportResult.data;
  if (report.status === 'archived') throw new Error('Use os documentos já vinculados à prestação arquivada.');
  const { data: template, error: templateError } = await user.from('finance_reporting_templates')
    .select('slug,version,structure,spreadsheet_template_path,narrative_template_path').eq('id', report.template_id).single();
  if (templateError || template?.slug !== 'faj-ii-ciclo') throw new Error('A versão vinculada não possui um gerador FAJ II Ciclo.');

  let source: Uint8Array<ArrayBuffer> | undefined;
  if (format !== 'pdf') {
    const config = object(object(template.structure).faj_exports);
    const sourceId = format === 'xlsx' ? template.spreadsheet_template_path : template.narrative_template_path;
    const approvedHash = config[`${format}_clean_template_sha256`];
    if (typeof approvedHash !== 'string' || !/^[a-f\d]{64}$/.test(approvedHash)) {
      throw new Error('A versão precisa de um modelo vazio revisado e de seu SHA-256 antes da exportação.');
    }
    source = await readSource(sourceId, root, spec.mime);
    if (await sha256(source) !== approvedHash) throw new Error('O arquivo oficial mudou desde a revisão da versão.');
  }
  const versionHash = await sha256(new TextEncoder().encode(JSON.stringify({ report, format, version: template.version, generatorVersion, sourceHash: source && await sha256(source) })));
  const key = `${format}:${versionHash}`;
  const reportFolder = await prepareAccountabilityFolder(reportId, root, user, admin);
  return await withCenterLease(`accountability-export:${reportId}`, admin, async () => {
    const destination = await ensureDriveFolder(reportFolder, format === 'pdf' ? 'RELATORIOS_CONSOLIDADOS' : 'DOCUMENTOS_OFICIAIS');
    const confirmed = await getDriveFolder(destination.id);
    if (!confirmed.parents?.includes(reportFolder) || !confirmed.capabilities?.canAddChildren) throw new Error('Destino de exportação indisponível.');
    await assertPrivateDriveFile(destination.id, true);

    const name = `${spec.name} - ${versionHash.slice(0, 12)}.${format}`;
    let generated = await findAccountabilityExport(destination.id, key);
    let checksum: string;
    if (generated) {
      if (!generated.parents?.includes(destination.id) || generated.mimeType !== spec.mime) throw new Error('O documento gerado tem um formato ou destino incompatível.');
      await assertPrivateDriveFile(generated.id, true);
      const response = await downloadDriveFile(generated.id);
      if (!response.ok) throw new Error('O documento gerado está indisponível.');
      checksum = await sha256(new Uint8Array(await response.arrayBuffer()));
    } else {
      const output = format === 'pdf' ? await renderFajConsolidatedPdf(report)
        : format === 'xlsx' ? await fillFajWorkbook(source!, report)
        : await fillFajNarrative(source!, report.narrative_data);
      const bytes = Uint8Array.from(output);
      checksum = await sha256(bytes);
      const file = new File([bytes], name, { type: spec.mime });
      generated = await uploadDriveFile(file, destination.id, { rkcAccountabilityExport: key });
      if (!generated || generated.mimeType !== spec.mime || !generated.parents?.includes(destination.id)) throw new Error('O envio do documento não foi confirmado.');
      await assertPrivateDriveFile(generated.id, true);
    }

    const result = await admin.rpc('record_finance_accountability_export', {
      export_report_id: reportId,
      export_type: spec.type,
      export_name: generated.name,
      export_mime: spec.mime,
      export_drive_id: generated.id,
      export_checksum: checksum,
      export_template_version: template.version,
      export_version_key: versionHash,
      export_format: format,
      export_actor: actor,
    });
    if (result.error) throw new Error('Arquivo criado no Drive, mas o vínculo falhou. Tente novamente para recuperar o vínculo.');
    return { id: generated.id, name: generated.name, format };
  });
}
