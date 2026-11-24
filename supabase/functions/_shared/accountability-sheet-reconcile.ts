// Pure reconciliation: callers must validate permissions and field mappings.
export type CellValue = string | number | boolean | null;
export type Cells = Record<string, CellValue>;
export function reconcileCells(base: Cells, panel: Cells, sheet: Cells, editableKeys: readonly string[]) {
  const toPanel: Cells = Object.create(null);
  const toSheet: Cells = Object.create(null);
  const conflicts: { key: string; base: CellValue; panel: CellValue; sheet: CellValue }[] = [];
  const missing: string[] = [];
  for (const key of new Set(editableKeys)) {
    if (![base, panel, sheet].every(source => Object.prototype.hasOwnProperty.call(source, key))) {
      missing.push(key);
      continue;
    }
    const b = base[key], p = panel[key], s = sheet[key];
    if (p === s) continue;
    if (p === b) toPanel[key] = s;
    else if (s === b) toSheet[key] = p;
    else conflicts.push({ key, base: b, panel: p, sheet: s });
  }
  return { toPanel, toSheet, conflicts, missing };
}
