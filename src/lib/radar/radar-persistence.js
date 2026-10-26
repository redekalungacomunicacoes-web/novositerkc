/** Persistência do Radar RKC. Executar SOMENTE no servidor com credenciais seguras.
 * Usa as tabelas existentes; não altera oportunidades já triadas.
 */
import { normalizeOpportunity, classifyOpportunity } from "./radar-core.js";

export function pncpOfficialUrl(id) {
  const match = /^(\d{14})-(\d+)-(\d{4})$/.exec(String(id));
  if (!match) throw new Error("Número de controle PNCP inválido");
  return `https://pncp.gov.br/app/editais/${match[1]}/${match[3]}/${match[2]}`;
}

export function prepareRadarRow(item, fonteId) {
  if (!fonteId) throw new Error("ID da fonte obrigatório");
  const record = normalizeOpportunity("pncp", item);
  const url = pncpOfficialUrl(record.external_id);
  return {
    fonte_id: fonteId,
    titulo: record.title || "Objeto não informado",
    organizador: item.orgaoEntidade?.razaoSocial ?? null,
    url_oficial: url,
    prazo: record.deadline ? String(record.deadline).slice(0, 10) : null,
    valor_estimado: record.estimated_value,
    area: classifyOpportunity(record).join(", ") || "A classificar",
    resumo: String(item.informacaoComplementar ?? "").slice(0, 2000),
    status_triagem: "nao_verificado"
  };
}

function check(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

/** Não usa upsert: jamais sobrescreve triagem humana ou histórico existente. */
export async function persistPncpBatch(supabase, items, fonteId, { dryRun = true } = {}) {
  const rows = items.map(item => prepareRadarRow(item, fonteId));
  const distinct = [...new Map(rows.map(row => [row.url_oficial, row])).values()];
  if (dryRun) return { examined: items.length, prepared: distinct.length, inserted: 0, dryRun: true };
  let inserted = 0, existing = 0, failures = [];
  for (const row of distinct) {
    const found = check(await supabase.from("captacao_radar_oportunidades")
      .select("id").eq("url_oficial", row.url_oficial).limit(1), "Consultar oportunidade");
    if (found?.length) { existing++; continue; }
    const result = await supabase.from("captacao_radar_oportunidades").insert(row);
    if (result.error?.code === "23505") { existing++; continue; }
    if (result.error) failures.push({ url: row.url_oficial, message: result.error.message });
    else inserted++;
  }
  return { examined: items.length, prepared: distinct.length, inserted, existing, failures, dryRun: false };
}
