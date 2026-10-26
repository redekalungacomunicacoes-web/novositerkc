import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOpportunity, identityKey, detectChanges, classifyOpportunity } from "../src/lib/radar/radar-core.js";

test("normaliza oportunidade PNCP", () => {
  const r = normalizeOpportunity("PNCP", { numeroControlePNCP: "123-2026", objetoCompra: "Serviços de comunicação", valorTotalEstimado: 1000 });
  assert.equal(r.external_id, "123-2026");
  assert.equal(r.estimated_value, 1000);
  assert.equal(identityKey(r), "pncp:123-2026");
});
test("não aceita registro sem ID oficial", () => {
  assert.throws(() => normalizeOpportunity("pncp", { objetoCompra: "Sem identificador" }), /Identificador oficial/);
});
test("detecta prorrogação sem perder valor anterior", () => {
  const a = normalizeOpportunity("pncp", { id: "1", objetoCompra: "Edital", prazo: "2026-11-01" });
  const b = normalizeOpportunity("pncp", { id: "1", objetoCompra: "Edital", prazo: "2026-11-10" });
  assert.deepEqual(detectChanges(a,b), [{ field: "deadline", before: "2026-11-01", after: "2026-11-10" }]);
});
test("classifica temas RKC", () => {
  const r = normalizeOpportunity("pncp", { id: "2", objetoCompra: "Produção audiovisual e comunicação comunitária" });
  assert.deepEqual(classifyOpportunity(r), ["comunicacao", "audiovisual"]);
});
