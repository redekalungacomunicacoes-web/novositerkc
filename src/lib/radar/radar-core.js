/** RKC Radar: deterministic normalization and comparison (no network or writes). */
export function normalizeOpportunity(source, item) {
  if (!source || !item || typeof item !== "object") throw new Error("Fonte e item obrigatórios");
  const officialId = String(item.numeroControlePNCP ?? item.numero_controle_pncp ?? item.id ?? "").trim();
  if (!officialId) throw new Error("Identificador oficial ausente");
  const title = String(item.objetoCompra ?? item.titulo ?? "").trim();
  const deadline = item.dataEncerramentoProposta ?? item.prazo ?? null;
  return {
    source: String(source).trim().toLowerCase(),
    external_id: officialId,
    title,
    deadline,
    official_url: item.linkSistemaOrigem ?? item.url_oficial ?? null,
    estimated_value: item.valorTotalEstimado ?? item.valor_estimado ?? null,
    raw: item
  };
}
export function identityKey(record) {
  return [record.source, record.external_id].map(x => encodeURIComponent(String(x))).join(":");
}
export function trackedFields(record) {
  return {
    title: record.title,
    deadline: record.deadline,
    official_url: record.official_url,
    estimated_value: record.estimated_value
  };
}
export function detectChanges(previous, current) {
  const a = trackedFields(previous), b = trackedFields(current);
  return Object.keys(b).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map(field => ({ field, before: a[field], after: b[field] }));
}
export function classifyOpportunity(record) {
  const t = record.title.toLocaleLowerCase("pt-BR");
  const tags = {
    cultura: /cultura|patrim[oô]nio|museu|mem[oó]ria|arte|quilomb/,
    comunicacao: /comunica[cç][aã]o|assessoria|imprensa|publicidade|m[ií]dia/,
    audiovisual: /audiovisual|document[aá]rio|filmagem|v[ií]deo|cinema|fotografia/,
    educacao: /educa[cç][aã]o|forma[cç][aã]o|capacita[cç][aã]o|oficina/,
    direitos: /direitos humanos|cidadania|igualdade|inclus[aã]o/,
    design: /design|identidade visual|diagrama[cç][aã]o|editora[cç][aã]o/,
    tecnologia: /software|site|portal|aplicativo|tecnologia|sistema/
  };
  return Object.entries(tags).filter(([, regex]) => regex.test(t)).map(([tag]) => tag);
}
