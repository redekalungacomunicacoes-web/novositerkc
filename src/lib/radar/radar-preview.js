/** RKC Radar PNCP: prévia segura. Nenhuma escrita é realizada por este script. */
import { iteratePncp, DEFAULT_MODALITIES } from "./pncp-client.js";
import { prepareRadarRow } from "./radar-persistence.js";

export async function previewPncpRadar({
  from, to, fonteId, modalities = DEFAULT_MODALITIES,
  fetchImpl = fetch, maxPages = 2, signal
}) {
  if (!fonteId) throw new Error("Fonte PNCP não configurada");
  const unique = new Map();
  const errors = [];
  let fetched = 0;
  for (const modality of modalities) {
    try {
      for await (const page of iteratePncp(
        { kind: "publicacao", from, to, modality },
        { fetchImpl, maxPages, signal }
      )) {
        for (const item of page.records) {
          fetched++;
          try {
            const row = prepareRadarRow(item, fonteId);
            if (row.area !== "A classificar") unique.set(row.url_oficial, row);
          } catch (error) {
            errors.push({ modality, stage: "normalize", message: String(error.message) });
          }
        }
      }
    } catch (error) {
      errors.push({ modality, stage: "fetch", message: String(error.message) });
    }
  }
  return {
    source: "PNCP",
    from, to,
    fetched,
    relevant: unique.size,
    rows: [...unique.values()],
    errors,
    complete: errors.length === 0,
    dryRun: true
  };
}
