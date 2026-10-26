/** Consulta somente leitura à API oficial do PNCP. */
const BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes";
export const DEFAULT_MODALITIES = [1, 4, 6, 8, 9, 12, 13];
function ymd(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida");
  return d.toISOString().slice(0,10).replaceAll("-","");
}
export function pncpUrl({ kind = "publicacao", from, to, modality, page = 1, pageSize = 50 }) {
  if (!["publicacao", "atualizacao"].includes(kind)) throw new Error("Tipo de consulta inválido");
  if (!Number.isInteger(modality) || modality < 1) throw new Error("Modalidade obrigatória");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error("Paginação inválida");
  const u = new URL(BASE + "/" + kind);
  u.searchParams.set("dataInicial", ymd(from));
  u.searchParams.set("dataFinal", ymd(to));
  u.searchParams.set("codigoModalidadeContratacao", String(modality));
  u.searchParams.set("pagina", String(page));
  u.searchParams.set("tamanhoPagina", String(pageSize));
  return u.toString();
}
export async function fetchPncpPage(params, { fetchImpl = fetch, signal } = {}) {
  const url = pncpUrl(params);
  const response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error("PNCP HTTP " + response.status);
  const body = await response.json();
  if (!body || !Array.isArray(body.data)) throw new Error("Resposta PNCP inesperada");
  return { records: body.data, totalPages: Number(body.totalPaginas ?? 1), url };
}
export async function* iteratePncp(params, { fetchImpl = fetch, signal, maxPages = 20 } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error("maxPages inválido");
  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchPncpPage({ ...params, page }, { fetchImpl, signal });
    yield result;
    if (page >= result.totalPages) return;
  }
  throw new Error("Limite de páginas atingido: coleta incompleta");
}
